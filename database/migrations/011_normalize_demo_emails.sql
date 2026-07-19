-- Keep demo emails valid for Pydantic EmailStr response validation.
update public.users
set email = replace(email, '@demo.argiai.local', '@demo.argiai.com')
where email like '%demo.argiai.local';
