# SIF Cloud Publisher
Converts all data available on the gateway to a format expected by the SIF cloud and publishes to the MQTT broker on the 
cloud.

## Data Format Conversion
The following example shows how to convert data from the NexusEdge format to the SIF cloud format.
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

This would be converted to this format:
```json
{
	"app_name": "pb1",
	"token": <cognito-access-token>,
	"data": {
	    "app_name": "pb1",
	    "time": "2021-07-01T09:41:00.000000Z",
	    "payload_fields": {
	        "sequence_number": {
	            "displayName": "sequence_number",
	            "unit": "na",
	            "value": 28810585
	        },
	        "rms_voltage": {
	            "displayName": "rms_voltage",
	            "unit": "na",
	            "value": 121.20
	        },
	        "power": {
	            "displayName": "power",
	            "unit": "na",
	            "value": 3.56
	        },
	        ...
	    },
	    "metadata": {
	        "handler_id": "lab11-handler",
	        "controller_id": "ble-controller",
	        "gateway_id": "some-id",
	        "device_type": "powerblade"
    	}
	}	
}
``` 

- config.json needs to be populated with the cloud endpoint details
- forwarded_topic: the data is transformed first, and then forwarded to this new topic at the CCRi cloud end.
- values cannot be of string type. 