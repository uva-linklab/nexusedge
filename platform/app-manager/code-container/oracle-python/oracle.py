import paho.mqtt.client as mqtt
import os
import json
from threading import Thread
import requests
import socket

app_topic = os.environ['TOPIC']
platform_topic = "platform-data"
callback_map = {}
platform_callback_list = []


# The callback for when the client receives a CONNACK response from the server.
def on_connect(client, userdata, flags, rc):
#     print("Connected with result code " + str(rc))

    # Subscribing in on_connect() means that if we lose the connection and
    # reconnect then subscriptions will be renewed.
    client.subscribe(app_topic)
    client.subscribe(platform_topic)


# The callback for when a PUBLISH message is received from the server.
def on_message(client, userdata, mqtt_message):
    # mqtt_message is of type MQTTMessage. Has fields topic, payload,..
    topic = mqtt_message.topic
    payload = mqtt_message.payload

    if topic == app_topic:
        message_json = json.loads(payload)
        device_id = message_json["device_id"]

        if device_id in callback_map:
            callback_map[device_id](message_json)  # call the callback fn

    elif topic == platform_topic:
        print("topic == platform_topic")
        message_json = json.loads(payload)
        api = message_json["_meta"]["api"]
        tag = message_json["_meta"]["tag"]

        for callback in platform_callback_list:
            callback(api, tag, message_json)


def on_disconnect(client, userdata, rc=0):
    print("DisConnected result code " + str(rc))
    client.loop_stop()


def connect():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    client.connect("localhost", 1883, 60)
    client.loop_forever()


clientloop_thread = Thread(target=connect)
clientloop_thread.start()


class Oracle:
    def __init__(self):
        print('init')

    def subscribe_for_platform_messages(self, callback):
        platform_callback_list.append(callback)
        print(f'[oracle] added platform msg callback')

    def receive(self, device_id, callback):
        callback_map[device_id] = callback
        print(f'[oracle] added callback for {device_id}')

    def disseminate_all(self, tag, data):
        ip_address = self.__get_ip_address()

        metadata = {
            "origin-address": ip_address,
            "api": "disseminate-all",
            "tag": tag
        }
        full_data = {"_meta": metadata, "data": data}

        url = 'http://localhost:5000/platform/disseminate-all'
        requests.post(url, json=full_data)

    # TODO: cache the ip
    def __get_ip_address(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            # doesn't even have to be reachable
            s.connect(('10.255.255.255', 1))
            ip = s.getsockname()[0]
        except Exception:
            ip = '127.0.0.1'
        finally:
            s.close()
        return ip
