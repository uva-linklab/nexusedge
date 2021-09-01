# LinkLab InfluxDB Publisher
Converts all data available on the gateway to a format expected by the linklab influxdb. To obtain data from NexusEdge
to flow to the linklab influxdb, there are two steps:
1. Convert data in a format recognizable by linklab's gateway software. 
2. Publish the data to the `gateway-data` MQTT topic. 
3. Run [linklab's script](https://github.com/lab11/gateway/blob/master/software/gateway-mqtt-influxdb/gateway-mqtt-influxdb.js) 
which picks up data from this topic and publishes to influxdb. 

## Data Format Conversion
The following example shows how to convert data from the NexusEdge format to the linklab gateway format.
Let's say we have this data from a sensor on the NexusEdge platform:

```json
{
        "device_id": "pb1",
        "device_type": "powerblade",
        "device_data": {
            "device":"PowerBlade",
            "sequence_number":28810585,
            "rms_voltage":121.20,
            "power":3.56,
            "apparent_power":29.76,
            "energy":28327.35,
            "power_factor":0.12,
            "flags":69
        },
        "_meta": {
            "received_time": "2021-07-01T09:41:00.000000Z",
            "handler_id": "lab11-handler",
            "controller_id": "ble-controller",
            "gateway_id": "some-id"
    }
}
```

This will be converted to this format:
```json
{
    "device":"powerblade", // type of the device
    
    // all payload fields here:
    "sequence_number":975237,
    "rms_voltage":120.19,
    "power":6.55,
    "apparent_power":20.36,
    "energy":462560.31,
    "power_factor":0.32,
    "flags":67,
    
    "_meta": {
        "received_time": "2021-07-01T09:41:00.000000Z", // used by influx for the time field
        "device_id":     "pb1", // the id of the device
        
        "handler_id": "lab11-handler",
        "controller_id": "ble-controller",
        "gateway_id": "some-id"
        
        // any other metadata fields can go here
    }
}
``` 

- config.json needs to be populated with the cloud endpoint details
- payload fields can be of string type 