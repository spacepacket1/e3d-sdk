# Python Examples

These examples use only the Python standard library.

## Run

From the `examples/python` directory:

```bash
python3 quick_start.py
python3 token_profile.py
python3 stories.py
python3 swap_quote_buy.py
```

## Environment variables

- `E3D_BASE_URL` - defaults to `https://e3d.ai/api`
- `E3D_API_KEY` - optional API key for authenticated endpoints
- `E3D_API_KEY_HEADER` - defaults to `x-api-key`
- `E3D_TIMEOUT_MS` - request timeout in milliseconds

## Notes

- `quick_start.py` and `stories.py` call the live E3D API.
- `swap_quote_buy.py` is a local math helper and does not make network requests.
- If you want the Python examples to mirror the full JS SDK surface more closely, the next step is to add a small generated client or `requests`-based wrapper.
