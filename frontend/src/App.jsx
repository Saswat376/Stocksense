import { Link, Route, Routes } from 'react-router-dom';

function HomePage() {
  return <main className="welcome"><p className="eyebrow">INVENTORY MANAGEMENT</p><h1>StockSense</h1><p>Your inventory workspace is ready.</p><Link to="/login">Go to login</Link></main>;
}

function LoginPage() {
  return <main className="welcome"><p className="eyebrow">STOCKSENSE</p><h1>Sign in</h1><p>Authentication screens will be added here.</p><Link to="/">Back to home</Link></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<HomePage />} /><Route path="/login" element={<LoginPage />} /><Route path="*" element={<HomePage />} /></Routes>;
}
