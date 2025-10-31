-- Insert current VIP users into user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'vip'::app_role
FROM auth.users
WHERE email = 'sandrine.guedra54@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'vip'::app_role
FROM auth.users
WHERE email = 'borderonpatricia7@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;