export default function Button({ variant = "primary", className = "", children, ...props }) {
  const base = variant === "secondary" ? "secondary-button" : "primary-button";
  return <button className={`${base} ${className}`.trim()} {...props}>{children}</button>;
}
