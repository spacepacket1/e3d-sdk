# Go Examples

These examples use the Go standard library only.

## Run

From the `examples/go` directory:

```bash
go run ./quick_start
go run ./token_profile
go run ./stories
go run ./swap_quote_buy
```

## Environment variables

- `E3D_BASE_URL` - defaults to `https://e3d.ai/api`
- `E3D_API_KEY` - optional API key for authenticated endpoints
- `E3D_API_KEY_HEADER` - defaults to `x-api-key`
- `E3D_TIMEOUT_MS` - request timeout in milliseconds

## Notes

- `quick_start` and `stories` call the live E3D API.
- `swap_quote_buy` is a local math helper and does not make network requests.
- The examples are organized as separate subcommands so each file can be run independently with `go run`.
