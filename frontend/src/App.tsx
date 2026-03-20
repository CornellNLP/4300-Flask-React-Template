import { RouterProvider } from "react-router";
import { router } from "./routes";
import { useEffect, useState } from "react";

function App() {
  const [useLlm, setUseLlm] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setUseLlm(data.use_llm));
  }, []);

  if (useLlm === null) return <></>;

  return <RouterProvider router={router} />;
}

export default App;
