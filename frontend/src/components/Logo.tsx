import logo from "../assets/footysearchlogo.png";

type LogoProps = {
  className?: string
}

function Logo({ className = "" }: LogoProps): JSX.Element {
    return (
      <img
        src={logo}
        alt="FOOTYSEARCH"
        className={`logo-image ${className}`.trim()}
      />
    );
  }
  export default Logo;