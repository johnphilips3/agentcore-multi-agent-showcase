"""
Enhanced Tool Processor for Nova Sonic Web App
Integrates original Nova Sonic tools with AgentCore agents and extended functionality
"""

import asyncio
import json
import logging
import uuid
import hashlib
import random
import datetime
import pytz
from typing import Dict, List, Any, Optional

import boto3
from agent_integration import AgentCoreConnector

logger = logging.getLogger(__name__)

class EnhancedToolProcessor:
    """Enhanced tool processor that combines Nova Sonic tools with AgentCore integration"""
    
    def __init__(self, agent_arn: Optional[str] = None, region: str = "us-east-1"):
        self.agent_arn = agent_arn
        self.region = region
        self.agent_connector = AgentCoreConnector(region) if agent_arn else None
        self.tasks = {}

    def get_tool_specifications(self) -> List[Dict]:
        """Get tool specifications for Nova Sonic"""
        tools = [
            {
                "toolSpec": {
                    "name": "getDateAndTimeTool",
                    "description": "Get information about the current date and time",
                    "inputSchema": {
                        "json": json.dumps({
                            "type": "object",
                            "properties": {},
                            "required": []
                        })
                    }
                }
            },
            {
                "toolSpec": {
                    "name": "trackOrderTool",
                    "description": "Retrieves real-time order tracking information and detailed status updates for customer orders by order ID. Provides estimated delivery dates. Use this tool when customers ask about their order status or delivery timeline.",
                    "inputSchema": {
                        "json": json.dumps({
                            "type": "object",
                            "properties": {
                                "orderId": {
                                    "type": "string",
                                    "description": "The order number or ID to track"
                                },
                                "requestNotifications": {
                                    "type": "boolean",
                                    "description": "Whether to set up notifications for this order",
                                    "default": False
                                }
                            },
                            "required": ["orderId"]
                        })
                    }
                }
            },
            {
                "toolSpec": {
                    "name": "alpacaFarmManagement",
                    "description": "Access alpaca farm management system for livestock tracking, health records, breeding information, and farm activities. Use this tool for any alpaca or farm-related queries.",
                    "inputSchema": {
                        "json": json.dumps({
                            "type": "object",
                            "properties": {
                                "action": {
                                    "type": "string",
                                    "enum": ["list_alpacas", "get_alpaca", "health_records", "breeding_records", "activities"],
                                    "description": "The action to perform"
                                },
                                "alpaca_id": {
                                    "type": "string",
                                    "description": "Alpaca ID for specific queries"
                                },
                                "query": {
                                    "type": "string",
                                    "description": "General query about the farm or alpacas"
                                }
                            },
                            "required": ["action"]
                        })
                    }
                }
            }
        ]
        
        # Add AgentCore tool if available
        if self.agent_arn:
            tools.append({
                "toolSpec": {
                    "name": "agentCoreAssistant",
                    "description": "Access specialized AgentCore AI assistant for complex queries, multi-domain expertise including math, language, computer science, and general knowledge. Use this for sophisticated reasoning tasks.",
                    "inputSchema": {
                        "json": json.dumps({
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "The question or request to send to the AgentCore assistant"
                                },
                                "context": {
                                    "type": "string",
                                    "description": "Additional context for the query"
                                }
                            },
                            "required": ["query"]
                        })
                    }
                }
            })
        
        return tools

    async def process_tool_async(self, tool_name: str, tool_content: Dict) -> Dict:
        """Process a tool call asynchronously"""
        task_id = str(uuid.uuid4())
        
        try:
            task = asyncio.create_task(self._execute_tool(tool_name, tool_content))
            self.tasks[task_id] = task
            result = await task
            return result
        finally:
            if task_id in self.tasks:
                del self.tasks[task_id]

    async def _execute_tool(self, tool_name: str, tool_content: Dict) -> Dict:
        """Execute the specific tool"""
        logger.info(f"Executing tool: {tool_name}")
        tool = tool_name.lower()
        
        if tool == "getdateandtimetool":
            return await self._get_date_time()
        elif tool == "trackordertool":
            return await self._track_order(tool_content)
        elif tool == "alpacafarmmanagement":
            return await self._alpaca_farm_management(tool_content)
        elif tool == "agentcoreassistant":
            return await self._query_agentcore(tool_content)
        else:
            return {"error": f"Unsupported tool: {tool_name}"}

    async def _get_date_time(self) -> Dict:
        """Get current date and time"""
        try:
            # Get current date in PST timezone
            pst_timezone = pytz.timezone("America/Los_Angeles")
            pst_date = datetime.datetime.now(pst_timezone)
            
            return {
                "formattedTime": pst_date.strftime("%I:%M %p"),
                "date": pst_date.strftime("%Y-%m-%d"),
                "year": pst_date.year,
                "month": pst_date.month,
                "day": pst_date.day,
                "dayOfWeek": pst_date.strftime("%A").upper(),
                "timezone": "PST"
            }
        except Exception as e:
            logger.error(f"Error getting date/time: {e}")
            return {"error": str(e)}

    async def _track_order(self, tool_content: Dict) -> Dict:
        """Track order with simulated long-running operation"""
        try:
            logger.info("TrackOrderTool starting operation that will take time...")
            await asyncio.sleep(2)  # Simulate processing time (reduced for web)
            
            # Extract order ID from tool content
            content = tool_content.get("content", {})
            if isinstance(content, str):
                content_data = json.loads(content)
            else:
                content_data = content
                
            order_id = content_data.get("orderId", "")
            request_notifications = content_data.get("requestNotifications", False)
            
            # Convert order_id to string if it's an integer
            if isinstance(order_id, int):
                order_id = str(order_id)
                
            # Validate order ID format
            if not order_id or not isinstance(order_id, str):
                return {
                    "error": "Invalid order ID format",
                    "orderStatus": "",
                    "estimatedDelivery": "",
                    "lastUpdate": ""
                }
            
            # Create deterministic randomness based on order ID
            seed = int(hashlib.md5(order_id.encode(), usedforsecurity=False).hexdigest(), 16) % 10000
            random.seed(seed)
            
            # Generate realistic tracking information
            statuses = [
                "Order received", 
                "Processing", 
                "Preparing for shipment",
                "Shipped",
                "In transit", 
                "Out for delivery",
                "Delivered",
                "Delayed"
            ]
            
            weights = [10, 15, 15, 20, 20, 10, 5, 3]
            status = random.choices(statuses, weights=weights, k=1)[0]
            
            # Generate delivery date logic
            today = datetime.datetime.now()
            if status == "Delivered":
                delivery_days = -random.randint(0, 3)
                estimated_delivery = (today + datetime.timedelta(days=delivery_days)).strftime("%Y-%m-%d")
            elif status == "Out for delivery":
                estimated_delivery = today.strftime("%Y-%m-%d")
            else:
                delivery_days = random.randint(1, 10)
                estimated_delivery = (today + datetime.timedelta(days=delivery_days)).strftime("%Y-%m-%d")

            # Handle notification request
            notification_message = ""
            if request_notifications and status != "Delivered":
                notification_message = f"You will receive notifications for order {order_id}"

            # Return tracking information
            tracking_info = {
                "orderStatus": status,
                "orderNumber": order_id,
                "notificationStatus": notification_message
            }

            # Add appropriate fields based on status
            if status == "Delivered":
                tracking_info["deliveredOn"] = estimated_delivery
            elif status == "Out for delivery":
                tracking_info["expectedDelivery"] = "Today"
            else:
                tracking_info["estimatedDelivery"] = estimated_delivery

            # Add location information based on status
            if status == "In transit":
                tracking_info["currentLocation"] = "Distribution Center"
            elif status == "Delivered":
                tracking_info["deliveryLocation"] = "Front Door"
                
            # Add additional info for delayed status
            if status == "Delayed":
                tracking_info["additionalInfo"] = "Weather delays possible"
                
            logger.info("TrackOrderTool completed successfully")
            return tracking_info
            
        except Exception as e:
            logger.error(f"Error tracking order: {e}")
            return {"error": f"Error processing order tracking: {str(e)}"}

    async def _alpaca_farm_management(self, tool_content: Dict) -> Dict:
        """Access alpaca farm management system"""
        try:
            content = tool_content.get("content", {})
            if isinstance(content, str):
                content_data = json.loads(content)
            else:
                content_data = content
                
            action = content_data.get("action")
            alpaca_id = content_data.get("alpaca_id")
            query = content_data.get("query", "")
            
            # Simulate access to the alpaca farm storage system
            # In a real implementation, this would connect to the actual API
            farm_api_url = "http://localhost:3000/api/v1"  # Assuming the farm API is running
            
            if action == "list_alpacas":
                return {
                    "action": "list_alpacas",
                    "data": [
                        {
                            "id": "alp-001",
                            "name": "Fluffy McFlufferson",
                            "breed": "Huacaya",
                            "age": 3,
                            "color": "White",
                            "status": "Healthy"
                        },
                        {
                            "id": "alp-002", 
                            "name": "Chompers",
                            "breed": "Suri",
                            "age": 5,
                            "color": "Brown",
                            "status": "Pregnant"
                        }
                    ],
                    "total_count": 2,
                    "message": "Retrieved alpaca list successfully"
                }
            elif action == "get_alpaca" and alpaca_id:
                return {
                    "action": "get_alpaca",
                    "alpaca": {
                        "id": alpaca_id,
                        "name": f"Alpaca {alpaca_id}",
                        "registration_number": f"REG-{alpaca_id}",
                        "birth_date": "2021-05-15",
                        "gender": "Female",
                        "color": "Light Fawn",
                        "weight": 150,
                        "height": 36,
                        "micron_count": 18.5,
                        "health_status": "Excellent",
                        "last_checkup": "2024-01-15"
                    },
                    "message": f"Retrieved details for alpaca {alpaca_id}"
                }
            elif action == "health_records":
                return {
                    "action": "health_records",
                    "records": [
                        {
                            "id": "hr-001",
                            "alpaca_id": alpaca_id or "alp-001",
                            "date": "2024-01-15",
                            "type": "Vaccination",
                            "description": "Annual vaccinations completed",
                            "veterinarian": "Dr. Smith",
                            "next_due": "2025-01-15"
                        },
                        {
                            "id": "hr-002",
                            "alpaca_id": alpaca_id or "alp-001", 
                            "date": "2024-03-10",
                            "type": "Routine Checkup",
                            "description": "General health examination - all normal",
                            "veterinarian": "Dr. Johnson"
                        }
                    ],
                    "message": "Health records retrieved successfully"
                }
            elif action == "breeding_records":
                return {
                    "action": "breeding_records",
                    "records": [
                        {
                            "id": "br-001",
                            "sire_name": "Champion Charlie",
                            "dam_name": "Beautiful Betty",
                            "breeding_date": "2023-08-15",
                            "expected_due": "2024-07-20",
                            "status": "Successful - Cria born healthy"
                        }
                    ],
                    "message": "Breeding records retrieved successfully"
                }
            elif action == "activities":
                return {
                    "action": "activities",
                    "activities": [
                        {
                            "id": "act-001",
                            "date": "2024-01-20",
                            "type": "Shearing",
                            "description": "Annual fiber harvest completed",
                            "performed_by": "Farm Staff",
                            "alpacas_involved": ["alp-001", "alp-002"]
                        },
                        {
                            "id": "act-002",
                            "date": "2024-02-01",
                            "type": "Feeding Program Update",
                            "description": "Updated nutrition plan for pregnant females",
                            "performed_by": "Veterinarian"
                        }
                    ],
                    "message": "Management activities retrieved successfully"
                }
            else:
                return {
                    "error": f"Unknown action: {action}",
                    "available_actions": ["list_alpacas", "get_alpaca", "health_records", "breeding_records", "activities"]
                }
                
        except Exception as e:
            logger.error(f"Error accessing alpaca farm management: {e}")
            return {"error": f"Error accessing farm management system: {str(e)}"}

    async def _query_agentcore(self, tool_content: Dict) -> Dict:
        """Query the AgentCore assistant"""
        if not self.agent_connector:
            return {"error": "No AgentCore agent configured"}
        
        try:
            content = tool_content.get("content", {})
            if isinstance(content, str):
                content_data = json.loads(content)
            else:
                content_data = content
                
            query = content_data.get("query", "")
            context = content_data.get("context", "")
            
            if not query:
                return {"error": "No query provided"}
            
            # Add context if provided
            full_prompt = f"{context}\n\n{query}" if context else query
            
            # Query the AgentCore agent
            result = await self.agent_connector.query_agent(
                self.agent_arn, 
                full_prompt
            )
            
            return {
                "query": query,
                "context": context,
                "response": result,
                "agent_arn": self.agent_arn,
                "message": "AgentCore query completed successfully"
            }
            
        except Exception as e:
            logger.error(f"Error querying AgentCore: {e}")
            return {"error": f"Error querying AgentCore agent: {str(e)}"}

    async def cleanup(self):
        """Cancel any pending tasks"""
        for task in self.tasks.values():
            if not task.done():
                task.cancel()
        self.tasks.clear()