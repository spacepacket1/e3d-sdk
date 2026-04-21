from e3d_client import E3DClient

TOKEN_ADDRESS = "0x6488861b401F427D13B6619C77C297366bCf6386"


def main() -> None:
    client = E3DClient()
    profile = client.get(f"/token/{TOKEN_ADDRESS}", query={"chain": "ETH"})
    print(profile)


if __name__ == "__main__":
    main()
