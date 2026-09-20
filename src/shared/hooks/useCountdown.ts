import { useEffect, useState } from "react";

/// Cuenta regresiva en segundos, para el reenvío del código.
export function useCountdown(initialSeconds: number) {
  // `initialSeconds` solo importa al montar: el valor inicial ya lo toma `useState`, y para arrancar una
  // cuenta nueva más tarde (por ejemplo, al reenviar el código) quien use el hook llama a `restart`. Un
  // efecto que reflejara `initialSeconds` en el estado en cada cambio dispararía un render extra de más.
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000);

    return () => clearTimeout(timer);
  }, [seconds]);

  return { seconds, isRunning: seconds > 0, restart: setSeconds };
}
