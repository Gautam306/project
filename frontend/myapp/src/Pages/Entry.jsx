import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Typewriter from "../Components/Typewriter";
import image from '../assets/CityMap.png';
import { useSocket } from "../ContextApi/SocketProvider";

const Entry = () => {
    const [user, setUser] = useState({ username: "", mapId: "" });
    const mapIdRef = useRef(null);
    const navigate = useNavigate();
    
    const {socket,remoteStream,setRemoteStream,myStream, setMyStream} = useSocket();
    const phrases = [
        "Welcome to the Metaverse 🌆",
        "Your journey starts here 🚀",
        "Explore, Connect, and Adventure!",
    ];

    const copymapId = () => {
        const inputElement = mapIdRef.current;
        if (inputElement) {
            inputElement.select();
            navigator.clipboard.writeText(inputElement.value)
                .then(() => alert("Room ID copied!"))
                .catch(() => alert("Failed to copy Room ID!"));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!user.username || !user.mapId) {
            alert("Please fill in both Username and Room ID to proceed!");
            return;
        }
       
        localStorage.setItem("userInfo",JSON.stringify({
            username:user.username,
            mapId:user.mapId,
            
        }));
        // socket.emit("room:join", { email:user.username, room:user.mapId });
        navigate("/city-map");
    };

    return (
        <div className="entry-container">

            {/* Left Side */}
            <div className="left-side">
                <div className="welcome-animation">
                 
                    <Typewriter toRotate={phrases} period={2000} />
                </div>
                <p className="welcome-subtitle">
                    Join a world full of adventures, where your imagination shapes the city. 🌟
                </p>
                <div className="floating-elements">
                    <div className="circle circle-1"></div>
                    <div className="circle circle-2"></div>
                    <div className="circle circle-3"></div>
                    <div className="circle circle-4"></div>
                    <div className="circle circle-2"></div>

                </div>
                {/* <img src={image} alt="Cityscape" className="cityscape" /> */}
            </div>

            {/* Right Side */}
            <div className="right-side">
                <div className="login-container">
                    <h2 className="login-title">🎮 Player Login 🎮</h2>
                    <form onSubmit={handleSubmit} className="form-group">
                        <div className="input-group">
                            <label className="input-label">
                                <span className="icon">👤</span> User Name
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={user.username}
                                className="input-field"
                                placeholder="Enter your username"
                                onChange={(e) => setUser({ ...user, [e.target.name]: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">
                                <span className="icon">🔑</span> Room ID
                            </label>
                            <div className="input-container">
                                <input
                                    type="text"
                                    ref={mapIdRef}
                                    name="mapId"
                                    value={user.mapId}
                                    id="room-id"
                                    className="input-field input-with-button"
                                    placeholder="Enter Room ID"
                                    onChange={(e) => setUser({ ...user, [e.target.name]: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    className="copy-button"
                                    onClick={copymapId}
                                    title="Copy Room ID"
                                >
                                    📋
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="submit-button">
                            Start Adventure!
                        </button>
                    </form>
                    <p className="info-text">Share the Room ID with your fellow adventurers!</p>
                </div>
            </div>

        </div>
    );
};

export default Entry;
