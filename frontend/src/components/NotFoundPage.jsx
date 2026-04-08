import { Link } from "react-router-dom";

export default function NotFoundPage({ isAuthenticated, fallbackPath }) {
  return (
    <section className="workspace workspace-centered">
      <div className="panel panel-404">
        <div className="panel-header">
          <div>
            <h2>Страница не найдена</h2>
            <p>Проверьте адрес или вернитесь в рабочий раздел.</p>
          </div>
        </div>

        <div className="not-found-code">404</div>

        <div className="not-found-actions">
          <Link className="btn btn-primary" to={fallbackPath}>
            {isAuthenticated ? "Вернуться в сервис" : "Перейти ко входу"}
          </Link>
        </div>
      </div>
    </section>
  );
}
