# Policy

### Time-based Policy
| Privacy Policy |      |               |             |
|:--------------:|:----:|:-------------:|:-----------:|
|     sensor     |  app |    interval   | block/allow |
|       s1       | app1 | * 06-07 * * * |     true    |
|        *       | app2 | * 08-17 * * * |     true    |
|      s2,s3     |   *  |  * 0-12 * * * |    false    |

### cron format
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, optional)

### Conditional Policy
| Conditional Policy |                                                   |
|:------------------:|:-------------------------------------------------:|
|       sensor       |                     condition                     |
|         co2        | block when occupancy = true and temperature >= 25 |
|     temperature    |            block when occupancy = true            |
|      occupancy     |                        n/a                        |

### Policy Format
```
privacyPolicy = {
    "condition": {
        "sensor1": {
            "temperature1": {
                "type": "numerical",
                "condition": ">=",
                "value": 25
            },
        "occupancy": {
                "type": "boolean",
                "condition": true,
                "value": null
            }
        }
    },
    "app-specific": {
        "gateway1": {
            "app1": {
                "block": true,
                "schedule": "* 09-10,13-15 * * *",
            }
        }
    },
    "sensor-specific": {
        "sensor1-id": {
            "block": false,
            "schedule": "* 09-10,13-15 * * *",
        }
    },
    "app-sensor": {
        "sensor1-id": {
            "gateway1-ip": {
                "app1-topic": {
                    "block": false,
                    "schedule": "* 09-10,13-15 * * *",
                }
            }
        }
    }
}
```