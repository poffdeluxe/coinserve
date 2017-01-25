# coinserve

Stupid fake currency service that's used to mimic a bitcoin transaction flow.

## Get started

By default, coinserve will generate a few seed addresses with a balance of "satoshis."

Alternatively, when starting the service, you can specify a JSON file with the following format:

```
  {
    "WIF_GOES_HERE": 1000
  }
```
