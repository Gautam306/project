import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import jsonFile from '../assets/officev1.json';
import setupImage from '../assets/office-top1.png';
import setupImage2 from '../assets/office-down2.png';
import avatarImage from '../assets/char.png';
import io from 'socket.io-client';
import { useSocket } from "../ContextApi/SocketProvider";
import { Socket } from 'socket.io-client';
import VideoCall from "../Components/VideoCall";
import SFU from "../Components/SFU";
import Chat from '../Components/Chat';

export const Map = () => {
    const gameRef = useRef(null);
    const gamesocket = useRef(null);
    const [roomIds, setRoomId] = useState("10");
    const [socketupdate, isSocketUpdate] = useState(null);
    const { socket, setMyStream, myStream, setRemoteStream, remoteStream, handleCallDisconnect } = useSocket();
    const [call, setCall] = useState(false);
    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    console.log("videoSocket id", socket.current?.id);
    console.log("Players out of proximity, distance:1223", remoteStream);
    const handleDisconnectionStream = async ({ data }) => {
        console.log("handleDisconnectionStream ", data);
        for (let i = 0; i < data.length; i++) {
            // if (data[i] != socket.current?.id) {
            handleCallDisconnect(data[i]);
            // }
        }
    }
    useEffect(() => {



        if (userInfo) {
            gamesocket.current = io('http://localhost:8002', {
                path: "/socket.io",
                transports: ["websocket"],
            });

            gamesocket.current.on("connect", () => {
                console.log("Socket connected with ID: ", gamesocket.current.id);
            });

            gamesocket.current.emit('new-user-add', userInfo.username, userInfo.mapId);


        }
        return () => {
            if (gamesocket.current) {

                gamesocket.current.disconnect();
                // videogamesocket.disconnect();
            }
            if (socket.current) {
                socket.current.disconnect();
            }
        };

    }, [])

    useEffect(() => {
        class CanvasGame extends Phaser.Scene {
            constructor() {
                super("CanvasGame");
                this.otherPlayers = {}; // Store other players
                this.activeRooms = {};
            }

            preload() {

                this.load.image("setup", setupImage);
                this.load.image("setup2", setupImage2);

                this.load.spritesheet("player", avatarImage, {
                    frameWidth: 50,
                    frameHeight: 50,
                });
                this.load.tilemapTiledJSON("map", jsonFile);
            }

            create() {

                const map = this.make.tilemap({ key: "map" });

                const tileset = map.addTilesetImage("office-up", "setup");
                const tileset2 = map.addTilesetImage("office-down", "setup2");
                const groundLayer = map.createLayer("Tile Layer 1", [tileset, tileset2])
                // const wallsLayer2 = map.createLayer("Layer1", tileset)
                const wallsLayer = map.createLayer("Layer2", tileset)
                const Layer4 = map.createLayer("Layer4", tileset);
                const Layer5 = map.createLayer("Layer 5", tileset);

                // Optional: Set collision properties if needed
                groundLayer.setCollisionByProperty({ collides: true });
                // wallsLayer2.setCollisionByProperty({ collides: true });
                wallsLayer?.setCollisionByProperty({ collides: true });
                Layer4?.setCollisionByProperty({ collides: true });
                Layer5?.setCollisionByProperty({ collides: true });

                this.physics.world.bounds.width = map.widthInPixels;
                this.physics.world.bounds.height = map.heightInPixels;
                console.log("map ", map.heightInPixels);
                this.player = this.physics.add.sprite(400, map.heightInPixels - 80, "player");
                this.nameTagGroup = this.add.group();
                this.player.setScale(0.4);
                // Setup the camera to follow the player
                this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
                this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
                this.cameras.main.setZoom(1.25);



                // Create a green dot above the player
                const greenDot = this.add.circle(this.player.x, this.player.y, 4, 0x00ff00); // Green color
                this.nameTagGroup.add(greenDot);

                // Create the name text
                const playerName = this.add.text(this.player.x, this.player.y, "You", {
                    font: "11px Arial",
                    fill: "#FFFFFF", // White color
                });
                // playerName.setOrigin(0.5); // Center the text
                this.nameTagGroup.add(playerName);

                // Add to the group so they move together
                this.nameTagGroup.setVisible(true);
                this.player.setCollideWorldBounds(true);
                // // this.physics.add.collider(this.player, wallsLayer2);
                this.physics.add.collider(this.player, groundLayer);
                // this.physics.add.collider(this.player, Layer4);
                // this.physics.add.collider(this.player, Layer5);
                // this.physics.add.collider(this.player, wallsLayer);

                this.cursors = this.input.keyboard.createCursorKeys();
                gamesocket.current.emit("requestActiveUsers", userInfo.mapId);

                gamesocket.current.on("currentPlayers", (players) => {

                    console.log("currentPlayer ", players, "  ", gamesocket.current.id);
                    Object.values(players).forEach((player) => {
                        console.log("currentPlayer ", players, "  ", gamesocket.current.id);
                        if (player.id !== gamesocket.current.id && !this.otherPlayers[player.id]) {
                            this.addOtherPlayer(player);
                        }
                    });
                    Object.values(this.otherPlayers).forEach((player) => {
                        console.log("other Player ", player);
                    })


                });



                gamesocket.current.on("newPlayer", (player) => {
                    if (player.id !== gamesocket.current.id && !this.otherPlayers[player.id]) {
                        this.addOtherPlayer(player);
                    }
                });


                gamesocket.current.on("playerMoved", (player) => {
                    const otherPlayer = this.otherPlayers[player.id];
                    if (otherPlayer) {
                        // console.log("player anim", player);
                        otherPlayer.setPosition(player.x, player.y);
                        if (player.anim) otherPlayer.anims.play(player.anim, true);
                        if (otherPlayer.nameTagGroup) {
                            otherPlayer.nameTagGroup.getChildren().forEach((child) => {
                                if (child.type == "Text") {
                                    child.setPosition(player.x, player.y - 22);
                                }
                                else {
                                    child.setPosition(player.x - 10, player.y - 15);
                                }
                            });
                        }
                    }
                });

                // , {
                //     path: "/socket.io",
                //     transports: ["websocket"],
                // }

                gamesocket.current.on('video-call-start', (roomId) => {
                    if (!socket.current) {
                        socket.current = io('http://localhost:5001');
                        setRoomId(roomId);
                        // email: userInfo.username,
                        socket.current.emit("join-room", { email: userInfo.username, roomId });
                        isSocketUpdate(socket.current);
                        localStorage.setItem('roomID', roomId);
                        console.log("video-call-start", socket.current, "        ", roomId);
                        // this.activeRooms[otherPlayerId] = true;
                    }
                })

                gamesocket.current.on('video-call-end', () => {
                    // if (socket.current) {
                    socket.current.disconnect();
                    socket.current = null;
                    isSocketUpdate(null);
                    localStorage.removeItem('roomID');
                    // }
                })


                // Listen for disconnected players
                gamesocket.current.on("user-left", (id) => {
                    const childArray = [];
                    if (this.otherPlayers[id]) {
                        console.log("user-left ", id);

                        if (this.otherPlayers[id].nameTagGroup) {
                            console.log("user-left 2", this.otherPlayers[id].nameTagGroup)
                            this.otherPlayers[id].nameTagGroup.getChildren().forEach(child => {
                                console.log("user-left3 ", child);
                                childArray.push(child);
                                // Destroy each child (green dot and name text)
                            });
                            this.otherPlayers[id].nameTagGroup.destroy(); // Destroy the group itself
                            // delete this.otherPlayers[id].nameTagGroup;

                            childArray.forEach(child => {
                                child.destroy();
                            });
                        }
                        this.otherPlayers[id].destroy();
                        delete this.otherPlayers[id];
                        console.log("user-left 4", this.otherPlayers[id])
                    }
                });




                // Define player animations
                // Define player animations
                // Define player animations
                this.anims.create({
                    key: 'walk-right',
                    frames: this.anims.generateFrameNumbers('player', { start: 0, end: 2 }),
                    frameRate: 10,
                    repeat: -1
                });

                this.anims.create({
                    key: 'walk-down',
                    frames: this.anims.generateFrameNumbers('player', { start: 12, end: 14 }),
                    frameRate: 10,
                    repeat: -1
                });

                this.anims.create({
                    key: 'walk-up',
                    frames: this.anims.generateFrameNumbers('player', { start: 24, end: 26 }),
                    frameRate: 10,
                    repeat: -1
                });

                this.anims.create({
                    key: 'walk-left',
                    frames: this.anims.generateFrameNumbers('player', { start: 36, end: 38 }),
                    frameRate: 10,
                    repeat: -1
                });

            }

            update() {
                const speed = 50;

                // Reset velocity
                this.player.setVelocity(0);

                // Movement logic
                let anim = null;
                if (this.cursors.left.isDown) {
                    this.player.setVelocityX(-speed);
                    anim = "walk-down";
                } else if (this.cursors.right.isDown) {
                    this.player.setVelocityX(speed);
                    anim = "walk-up";
                } else if (this.cursors.up.isDown) {
                    this.player.setVelocityY(-speed);
                    anim = "walk-left";
                } else if (this.cursors.down.isDown) {
                    this.player.setVelocityY(speed);
                    anim = "walk-right";

                }

                if (anim) {
                    this.player.anims.play(anim, true);
                    gamesocket.current.emit("playerMove", {
                        x: this.player.x,
                        y: this.player.y,
                        anim,
                    });
                } else {
                    this.player.anims.stop();
                }

                this.nameTagGroup.getChildren().forEach((child) => {
                    if (child.type == "Text") {
                        child.setPosition(this.player.x, this.player.y - 22);
                    }
                    else {
                        child.setPosition(this.player.x - 10, this.player.y - 15);
                    }
                });

            }


            addOtherPlayer(player) {
                const otherPlayer = this.add.sprite(player.x, player.y, "player");
                otherPlayer.anims.play(player.anim || "walk-down", true);
                otherPlayer.setScale(0.4);
                this.otherPlayers[player.id] = otherPlayer;

                // Create a group for the new player's name and do
                const nameTagGroup = this.add.group();

                // Create a green dot above the other player
                const greenDot = this.add.circle(player.x - 10, player.y - 20, 5, 0x00ff00); // Green color
                nameTagGroup.add(greenDot);

                // Create the name text
                const playerName = this.add.text(player.x, player.y - 30, player.username, {
                    font: "11px Arial",
                    fill: "#FFFFFF", // White color
                });
                // playerName.setOrigin(0.5); // Center the text
                nameTagGroup.add(playerName);

                // Add the group to the player object
                this.otherPlayers[player.id].nameTagGroup = nameTagGroup;
            }

            // Emit player movement to the server


        }


        const config = {
            type: Phaser.AUTO,
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                width: '100%',
                height: '100%',
            },
            physics: {
                default: "arcade",
                arcade: {
                    gravity: { y: 0 },
                    debug:true
                },
            },
            scene: CanvasGame,
            parent: "phaser-game",
        };

        gameRef.current = new Phaser.Game(config);

        return () => {
            if (gameRef.current) {
                gameRef.current.destroy(true);
            }
        };
    }, []);

    console.log("video socket", socket.current);

    return (
        <>
            {/* <VideoCall/> */}
            <div id="phaser-game" style={{ width: "100vw", height: "85vh", }}></div>
            <Chat />
            <SFU key={Date.now()} roomId={roomIds} />

        </>)

};

export default Map;