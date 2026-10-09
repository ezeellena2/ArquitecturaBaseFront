import { useCallback, useEffect, useState, type SetStateAction } from "react";

function countdownFrom(seconds: number) {
  const duration = Math.max(0, seconds);

  return { seconds: duration, deadline: performance.now() + duration * 1000 };
}

/// Cuenta regresiva de presentación: el servidor sigue siendo dueño del plazo y de la autorización.
export function useCountdown(initialSeconds: number) {
  // `initialSeconds` solo importa al montar: el valor inicial ya lo toma `useState`, y para arrancar una
  // cuenta nueva más tarde (por ejemplo, al reenviar el código) quien use el hook llama a `restart`. Un
  // efecto que reflejara `initialSeconds` en el estado en cada cambio dispararía un render extra de más.
  const [countdown, setCountdown] = useState(() => countdownFrom(initialSeconds));
  const { seconds, deadline } = countdown;

  const restart = useCallback((nextSeconds: SetStateAction<number>) => {
    setCountdown((current) => countdownFrom(
      typeof nextSeconds === "function" ? nextSeconds(current.seconds) : nextSeconds,
    ));
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function refresh() {
      clearTimeout(timer);
      const remainingMilliseconds = Math.max(0, deadline - performance.now());
      const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);

      setCountdown((current) => current.deadline !== deadline || current.seconds === remainingSeconds
        ? current
        : { ...current, seconds: remainingSeconds });

      if (remainingMilliseconds > 0) {
        // El timer sólo despierta: una pestaña suspendida no acumula ticks pendientes.
        timer = setTimeout(refresh, Math.min(1000, remainingMilliseconds));
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    refresh();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [deadline]);

  return { seconds, isRunning: seconds > 0, restart };
}
