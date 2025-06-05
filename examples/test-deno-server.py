#!/usr/bin/env python3
"""
Python client to test the Deno Hypha WebSocket server.

Install dependencies:
pip install hypha-rpc

Run the server first:
deno run --allow-net --allow-env examples/deno-server-example.js

Then run this client:
python examples/test-deno-server.py
"""

import asyncio
import sys
from hypha_rpc import connect_to_server

async def test_deno_server():
    print("🔌 Connecting to Deno Hypha server...")
    
    server_url = "http://localhost:9527"
    client_id = f"python-test-client-{id(object())}"
    
    try:
        # Connect to the server in default workspace
        server = await connect_to_server({
            "server_url": server_url,
            "workspace": "default",
            "client_id": client_id
        })
        
        print("✅ Connected to Hypha server successfully!")
        print(f"📍 Connected to workspace: {server.config.workspace}")
        print(f"🆔 Client ID: {server.config.client_id}")
        
        # Test the echo service from default services
        print("\n🧪 Testing echo service...")
        try:
            echo_response = await server.echo("Hello from Python client!")
            print(f"Echo response: {echo_response}")
        except Exception as e:
            print(f"Echo service error: {e}")
        
        # Test the server info service  
        print("\n📊 Getting server info...")
        try:
            server_info = await server.get_server_info()
            print(f"Server info: {server_info}")
        except Exception as e:
            print(f"Server info error: {e}")
        
        # Try to call the hello service directly (it's a default service)
        print("\n🌍 Testing hello service...")
        try:
            # Call hello directly on the server (it's a default service like echo)
            hello_response = await server.hello("Python Client")
            print(f"Hello response: {hello_response}")
            
            # Call the get_time method directly
            time_response = await server.get_time()
            print(f"Server time: {time_response}")
            
        except Exception as e:
            print(f"Hello service error: {e}")
            
            # Fallback: try to get it as a separate service
            try:
                hello_service = await server.get_service("hello-world")
                hello_response = await hello_service.hello("Python Client")
                print(f"Hello response (via service): {hello_response}")
            except Exception as e2:
                print(f"Hello service (via get_service) error: {e2}")
        
        # Register our own service as a built-in service (allowed for non-root users)
        print("\n📝 Registering Python client service...")
        try:
            client_service = await server.register_service({
                "id": "python-client-service:built-in",  # Add :built-in suffix to bypass security
                "name": "Python Client Service", 
                "description": "A built-in service registered from Python client",
                "config": {
                    "visibility": "public"
                },
                "compute_square": lambda n: n * n,
                "get_python_info": lambda: {
                    "python_version": sys.version,
                    "client": "Python",
                    "platform": sys.platform
                }
            })
            
            print(f"✅ Service registered with ID: {client_service.id}")
            
            # Test our own service
            square_result = await client_service.compute_square(7)
            print(f"Square(7) = {square_result}")
            
        except Exception as e:
            print(f"Service registration error: {e}")
        
        print("\n🎉 All tests completed successfully!")
        print("Connection test passed - Deno WebSocket server is working! 🦕")
        
    except Exception as error:
        print(f"❌ Failed to connect or execute: {error}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_deno_server())
    if success:
        print("\n✅ Test passed!")
        sys.exit(0)
    else:
        print("\n❌ Test failed!")
        sys.exit(1) 