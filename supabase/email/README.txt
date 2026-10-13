Supabase -> Authentication -> Emails -> Templates

Magic Link
  Subject: Your Floor 2 Rafters sign-in link
  Body: paste magic-link.html

Confirm signup
  Subject: Confirm your email for Floor 2 Rafters
  Body: paste confirm-signup.html

Both use {{ .ConfirmationURL }} for the button and {{ .Token }} for the 6-digit code (the phone app signs in with the code). The logo loads from https://floor2rafters.com/icons/icon-192.png, so it shows once the site is live.
