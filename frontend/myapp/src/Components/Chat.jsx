import React, { useState, useEffect, useRef } from "react";
import { Send } from "react-feather";
import { useSocket } from "../ContextApi/SocketProvider";
import Draggable from "react-draggable";

const Chat = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const {socket} = useSocket();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    console.log("chat:message")
    socket.current.on("chat:message", ({ sender, message, timestamp }) => {
      setMessages((prev) => [...prev, { sender, message, timestamp, type: "received" }]);
    });

    return () => {
      socket.current.off("chat:message");
    };
  }, [socket.current]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const messageData = {
        message: newMessage,
        timestamp: new Date().toISOString(),
        room: roomId,
      };

      socket.current.emit("chat:send", messageData);
      setMessages((prev) => [
        ...prev,
        {
          sender: "You",
          message: newMessage,
          timestamp: messageData.timestamp,
          type: "sent",
        },
      ]);
      setNewMessage("");
    }
  };

  return (
    <Draggable>
      <div
        className="chat-box"
        style={{
          position: "fixed",
          width: "250px",
          height: "300px",
          backgroundColor: "#1c2427",
          color: "white",
          borderRadius: "8px",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
          cursor: "move",
          zIndex: 1000,
        }}
      >
        {/* Header */}
        <div
          className="chat-header"
          style={{
            backgroundColor: "#333",
            padding: "10px",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          Chat Room
        </div>

        {/* Messages Area */}
        <div
          className="chat-messages"
          style={{
            flex: 1,
            padding: "10px",
            overflowY: "auto",
            height: "200px",
          }}
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                textAlign: msg.type === "sent" ? "right" : "left",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  maxWidth: "70%",
                  padding: "8px",
                  borderRadius: "8px",
                  backgroundColor: msg.type === "sent" ? "#1db954" : "#2e2e2e",
                  color: msg.type === "sent" ? "black" : "white",
                }}
              >
                <div style={{ fontSize: "12px", marginBottom: "4px", fontWeight: "bold" }}>
                  {msg.type === "sent" ? "You" : msg.sender}
                </div>
                <div>{msg.message}</div>
                <div style={{ fontSize: "10px", marginTop: "4px", color: "#aaa" }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form
          onSubmit={sendMessage}
          style={{
            padding: "10px",
            borderTop: "1px solid #444",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #555",
              backgroundColor: "#2e2e2e",
              color: "white",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: "#1db954",
              border: "none",
              color: "black",
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </Draggable>
  );
};

export default Chat;
