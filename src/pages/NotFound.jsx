import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="not-found-container">
      <div className="not-found-code">404</div>
      <h1 className="not-found-title">Page Not Found</h1>
      <p className="not-found-desc">
        The page you are looking for does not exist or has been moved to a different location.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
}

export default NotFound;