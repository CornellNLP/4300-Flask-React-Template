import { useNavigate } from "react-router";
import imgCandles from "../assets/table3.png";
import imgFood from "../assets/bread.png";
import "./OutputPage.css";

export function OutputPage() {
  const navigate = useNavigate();

  const handleRoundTwo = () => {
    navigate("/");
  };

  return (
    <div className="output-page">
      {/* ── MENU SECTION ── */}
      <section className="section-menu">
        <h1 className="section-heading">MENU</h1>

        <div className="menu-body">
          <div className="recipes">
            {[
              {
                title: "recipe one",
                body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
              },
              {
                title: "recipe two",
                body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
              },
              {
                title: "recipe three",
                body: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
              },
            ].map(({ title, body }) => (
              <div key={title} className="recipe-entry">
                <p className="recipe-title">{title}</p>
                <p className="recipe-body">{body}</p>
              </div>
            ))}
          </div>

          <aside className="candles-aside" aria-hidden="true">
            <img
              alt="decorative candles illustration"
              className="candles-img"
              src={imgCandles}
            />
          </aside>
        </div>
      </section>

      {/* ── DECOR + TUNES SECTION ── */}
      <section className="section-bottom">
        <div className="decor-col">
          <h2 className="section-heading">DECOR</h2>
          <p className="body-text">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>

        <div className="tunes-col">
          <h2 className="section-heading">TUNES</h2>
          <div className="playlist">
            <p className="playlist-title">playlist title</p>
            {Array.from({ length: 15 }, (_, i) => (
              <p key={i} className="playlist-row">
                <span className="song-name">song name</span>
                <span className="dots" aria-hidden="true" />
                <span className="artist">artist</span>
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="page-footer">
        <div className="food-decor" aria-hidden="true">
          <img alt="" className="food-img food-img--tilted" src={imgFood} />
          <img alt="" className="food-img food-img--straight" src={imgFood} />
        </div>

        <button onClick={handleRoundTwo} className="round-two-btn">
          ← round two
        </button>
      </footer>
    </div>
  );
}
