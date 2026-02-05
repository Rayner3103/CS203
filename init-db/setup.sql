INSERT INTO users (email, password, role) 
VALUES ('root@root.com', '$2a$10$8.K96GOf4S7.v1n8/6Uv1uS6jM.6..5.6..5.6..', 'SUPER_ADMIN') 
ON CONFLICT (email) DO NOTHING;