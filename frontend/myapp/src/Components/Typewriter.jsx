import React, { useEffect, useState } from "react";


const Typewriter = ({ toRotate, period }) => {
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [delta, setDelta] = useState(200);

  useEffect(() => {
    const handleTyping = () => {
      const i = loopNum % toRotate.length;
      const fullTxt = toRotate[i];

      if (isDeleting) {
        setText((prev) => fullTxt.substring(0, prev.length - 1));
        setDelta(100); // Speed up when deleting
      } else {
        setText((prev) => fullTxt.substring(0, prev.length + 1));
        setDelta(200 - Math.random() * 100); // Random typing speed
      }

      if (!isDeleting && text === fullTxt) {
        setDelta(period); // Pause at full text
        setIsDeleting(true);
      } else if (isDeleting && text === "") {
        setIsDeleting(false);
        setLoopNum((prev) => prev + 1);
        setDelta(500); // Pause before starting new text
      }
    };

    const timer = setTimeout(handleTyping, delta);

    return () => clearTimeout(timer);
  }, [text, isDeleting, toRotate, loopNum, delta, period]);

  return (
    <h1>
      <span className="typewrite">
        <span className="wrap">{text}</span>
      </span>
    </h1>
  );
};

export default Typewriter;
