import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import imgIstockphoto2098046718612X612RemovebgPreview2 from "../assets/table2.png";
import { Recipe, Playlist, PlaylistRecommendations } from "../types";

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
    const { query, recipeUrl, ...inputState } = (location.state ?? {}) as {
      query: string;
      recipeUrl: string;
      [key: string]: unknown;
    };
    const q = query || "food";
    const url = recipeUrl || `/api/recipes/svd?name=${encodeURIComponent(q)}`;

    const fetchData = async () => {
      try {
        const [recipesRes, playlistRes] = await Promise.all([
          fetch(url),
          fetch(`/api/playlists?name=${encodeURIComponent(q)}`),
        ]);
        const fetchedRecipes: Recipe[] = await recipesRes.json();
        const playlistData = await playlistRes.json();

        // Handle array and object (LLM) responses
        let playlist: Playlist | PlaylistRecommendations | null = null;
        if (Array.isArray(playlistData)) {
          playlist = playlistData[0] ?? null;
        } else if (playlistData && typeof playlistData === "object") {
          playlist = playlistData;
        }

        navigate("/output", { state: { ...inputState, recipes: fetchedRecipes, playlist } });
      } catch (err) {
        console.error("Failed to fetch party data:", err);
        navigate("/output", { state: { ...inputState, recipes: [], playlist: null } });
      }
    };

    fetchData();
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
