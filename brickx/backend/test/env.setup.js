// Dummy env so server.js boot guards pass under test. No real services are hit:
// Supabase is mocked in the route tests, and sendEmail() no-ops while
// RESEND_API_KEY is unset (so no email provider is needed).
process.env.NODE_ENV = "test";
process.env.PORT = "0"; // bind a random free port
process.env.JWT_SECRET = "test_secret_" + "a".repeat(40);
process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test_service_role_key";
