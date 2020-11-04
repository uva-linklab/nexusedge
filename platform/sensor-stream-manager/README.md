# Policy

### Time-based Policy
<table class="tg">
<thead>
  <tr>
    <th class="tg-c3ow" colspan="4">Privacy Policy</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td class="tg-c3ow">sensor</td>
    <td class="tg-c3ow">app</td>
    <td class="tg-c3ow">interval</td>
    <td class="tg-c3ow">block/allow</td>
  </tr>
  <tr>
    <td class="tg-c3ow">s1</td>
    <td class="tg-c3ow">app1</td>
    <td class="tg-c3ow">* 06-07 * * *</td>
    <td class="tg-c3ow">true</td>
  </tr>
  <tr>
    <td class="tg-c3ow">*</td>
    <td class="tg-c3ow">app2</td>
    <td class="tg-c3ow">* 08-17 * * *</td>
    <td class="tg-c3ow">true</td>
  </tr>
  <tr>
    <td class="tg-c3ow">s2,s3</td>
    <td class="tg-c3ow">*</td>
    <td class="tg-c3ow">* 0-12 * * *</td>
    <td class="tg-c3ow">false</td>
  </tr>
</tbody>
</table>

### cron format
```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, optional)
```
### Conditional Policy
<table class="tg">
<thead>
  <tr>
    <th class="tg-c3ow" colspan="2">Conditional Policy</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td class="tg-c3ow">sensor</td>
    <td class="tg-c3ow">condition</td>
  </tr>
  <tr>
    <td class="tg-c3ow">co2</td>
    <td class="tg-c3ow">block when occupancy = true and temperature &gt;= 25</td>
  </tr>
  <tr>
    <td class="tg-c3ow">temperature</td>
    <td class="tg-c3ow">block when occupancy = true</td>
  </tr>
  <tr>
    <td class="tg-c3ow">occupancy</td>
    <td class="tg-c3ow">n/a</td>
  </tr>
</tbody>
</table>

### Policy Format
```json
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
