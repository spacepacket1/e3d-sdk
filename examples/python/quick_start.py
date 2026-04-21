from e3d_client import E3DClient


def main() -> None:
    client = E3DClient()
    openapi = client.get("/openapi")
    rate = client.get("/rate")

    title = (openapi or {}).get("info", {}).get("title", "unknown")
    print(f"OpenAPI title: {title}")
    print(f"Current rate: {rate.get('rate') if isinstance(rate, dict) else rate}")


if __name__ == "__main__":
    main()
