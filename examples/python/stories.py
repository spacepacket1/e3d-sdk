from e3d_client import E3DClient


def main() -> None:
    client = E3DClient()
    stories = client.get("/stories", query={"limit": 5})
    addresses = client.get("/stories/addresses")

    print(f"Stories: {len(stories) if isinstance(stories, list) else 'unknown'}")
    print(f"Addresses sample: {addresses[:3] if isinstance(addresses, list) else addresses}")


if __name__ == "__main__":
    main()
