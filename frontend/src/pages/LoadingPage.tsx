import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import imgIstockphoto2098046718612X612RemovebgPreview2 from "../assets/table2.png";

const loadingMessages = [
  "setting the table",
  "finalizing the menu",
  "sending out invites",
  "selecting the perfect playlist",
  "choosing the decor",
];

export function LoadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [dots, setDots] = useState("");
  const [isTypingDots, setIsTypingDots] = useState(false);

  useEffect(() => {
    const currentMessage = loadingMessages[messageIndex];
    let charIndex = 0;

    // Type out the message
    const typeInterval = setInterval(() => {
      if (charIndex < currentMessage.length) {
        setDisplayText(currentMessage.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTypingDots(true);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [messageIndex]);

  useEffect(() => {
    if (!isTypingDots) return;

    let dotCount = 0;
    const dotInterval = setInterval(() => {
      if (dotCount < 3) {
        dotCount++;
        setDots(" .".repeat(dotCount));
      } else {
        clearInterval(dotInterval);
        setTimeout(() => {
          setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
          setDisplayText("");
          setDots("");
          setIsTypingDots(false);
        }, 300);
      }
    }, 400);

    return () => clearInterval(dotInterval);
  }, [isTypingDots]);

  useEffect(() => {
    // Navigate to output page after 8 seconds, forwarding the state from InputPage
    const navigationTimeout = setTimeout(() => {
      navigate("/output", { state: location.state });
    }, 8000);

    return () => clearTimeout(navigationTimeout);
  }, [navigate, location.state]);

  return (
    <div
      className="bg-[#fffef9] relative size-full min-h-screen flex flex-col items-center justify-center"
      data-name="loading screen"
    >
      <div
        className="h-[300px] sm:h-[400px] w-[400px] sm:w-[558px] mb-8"
        data-name="istockphoto-2098046718-612x612-removebg-preview 2"
      >
        <img
          alt="table setting illustration"
          className="max-w-none object-cover pointer-events-none size-full"
          src={imgIstockphoto2098046718612X612RemovebgPreview2}
        />
      </div>

      <p className="font-source-serif font-normal italic leading-[38px] text-center text-[#d43c00] text-[24px] sm:text-[30px] px-4">
        &nbsp;
        {displayText}
        {dots}
      </p>
    </div>
  );
}
