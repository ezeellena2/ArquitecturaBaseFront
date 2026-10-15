import {useEffect,useRef,type ReactNode} from "react";
import {Button} from "./button";
export function PhotoThumbnail({label,selected,onClick,children}:{label:string;selected?:boolean;onClick:()=>void;children:ReactNode}) {
 const button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(selected)button.current?.scrollIntoView({block:"nearest",inline:"nearest"});},[selected]);
 return <Button ref={button} type="button" variant="outline" className="relative h-16 w-16 shrink-0 overflow-hidden p-0 aria-pressed:ring-2 aria-pressed:ring-ring" aria-label={label} aria-pressed={selected} onClick={onClick}>{children}</Button>;
}
