# Leviton Lighting Handler
Enables apps to interact with [Leviton Provolt](https://www.leviton.com/en/products/brands/provolt) BLE based smart lights.

The handler supports two operations:
1. Set the state of the light (on/off)
2. Set the maximum brightness level of the light (1%, 25%, 50%, 75%, 100%) 

Accepted messages:
```json
{
    requestType: "stateControl",
    payload: { 
      "state": "on" OR "off"
    }
}
```
OR
```json
{
    requestType: "brightnessControl",
    payload: { 
      "brightness": value 
    }
}
```

This code is reverse engineered from the [Provolt Room Controller](https://apps.apple.com/us/app/provolt-room-controller/id1076989201) iOS app.