import React from "react";
import TcBcards from "./components/TcB";
import TcNcards from "./components/TcN";
import backCard from "./images/back.svg";

type CardType =
    "2c" | "3c" | "4c" | "5c" | "6c" | "7c" | "8c" | "9c" |
    "Tc" | "Jc" | "Qc" | "Kc" | "Ac" |
    "2h" | "3h" | "4h" | "5h" | "6h" | "7h" | "8h" | "9h" |
    "Th" | "Jh" | "Qh" | "Kh" | "Ah" |
    "2s" | "3s" | "4s" | "5s" | "6s" | "7s" | "8s" | "9s" |
    "Ts" | "Js" | "Qs" | "Ks" | "As" |
    "2d" | "3d" | "4d" | "5d" | "6d" | "7d" | "8d" | "9d" |
    "Td" | "Jd" | "Qd" | "Kd" | "Ad";

const PlayingCard = (props: { card?: CardType, back?: boolean, large?: boolean, className?: string, style?: React.CSSProperties, height?: number }) => {
    const imgSrc = props.back || !props.card ? backCard : props.large ? TcBcards[props.card] : TcNcards[props.card];
    let style = props.style;
    if (props.height !== undefined)
        style = { ...style, height: props.height };
    const className = (props.className || "") + " playingcard playingcard_" + (props.back ? "back" : "front");
    return <img src={imgSrc} className={className} style={style} alt={props.back ? 'back' : props.card}/>;
}

export default PlayingCard;