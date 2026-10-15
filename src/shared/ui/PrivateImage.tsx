import { useEffect, useRef, type ComponentProps } from "react";
export function PrivateImage({blob,...props}:Omit<ComponentProps<"img">,"src">&{blob:Blob}) {
 const image=useRef<HTMLImageElement>(null);
 useEffect(()=>{
  const element=image.current;if(!element)return;
  const url=URL.createObjectURL(blob);element.src=url;
  return ()=>{element.removeAttribute("src");URL.revokeObjectURL(url);};
 },[blob]);
 // The consumer supplies the accessible alternative text.
 return <img {...props} ref={image}/>;
}
