import { useEffect, useState } from "react";
import api from "../services/api";

function Home() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchAPI = async () => {
      try {
        const res = await api.get("/");
        setMessage(res.data.message);
      } catch (err) {
        console.error(err);
      }
    };

    fetchAPI();
  }, []);

  return (
    <div>
      <h1>CivicPulse</h1>
      <p>{message}</p>
    </div>
  );
}

export default Home;