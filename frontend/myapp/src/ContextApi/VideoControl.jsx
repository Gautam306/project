import React, { createContext, useMemo, useContext, useState, useEffect, useRef, useCallback } from "react";


const VideoContext = createContext(null);

export const useVideo = () => {
  return useContext(VideoContext);
};

export const VideoProvider = ({ children }) => {
  
    const [videoControl,setVideoControl]=useState(true);

  return (
    <VideoContext.Provider value={{videoControl,setVideoControl}}>
      {children}
    </VideoContext.Provider>
  );
};
