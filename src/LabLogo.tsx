export const LAB_NAME='지능형 연성 나노 소재 연구실';
export const LAB_ENGLISH='Intelligent Soft Nano Materials';
export function LabLogo(){return <><img className="lab-logo-symbol" src="/brand/isnm-symbol.png" alt="" width="48" height="45"/><span className="lab-logo-text"><strong>ISNM <span>LAB</span></strong><small>{LAB_NAME}</small></span></>}
export function LabHeroIdentity(){return <div className="lab-hero-identity" aria-label={LAB_ENGLISH+' LAB'}><div className="lab-logo-orbit orbit-yellow"/><div className="lab-logo-orbit orbit-pink"/><div className="lab-logo-orbit orbit-green"/><img src="/brand/isnm-symbol.png" alt="지능형 연성 나노 소재 연구실 로고" width="210" height="194"/><div className="lab-hero-wordmark"><strong>ISNM LAB</strong><span>Intelligent <b>Soft</b><br/>Nano Materials</span></div></div>}
