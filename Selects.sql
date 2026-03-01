/* Verifica banco atual */
SELECT DATABASE();

/* Estrutura criada */
SHOW TABLES;

/* Verificar estrutura detalhada */
DESCRIBE roles;
DESCRIBE units;
DESCRIBE users;
DESCRIBE charges;
DESCRIBE common_areas;
DESCRIBE reservations;
DESCRIBE visitors;
DESCRIBE notifications;

/* Teste geral */
SELECT * FROM roles;
SELECT * FROM units;
SELECT * FROM users;
SELECT * FROM charges;
SELECT * FROM reservations;
SELECT * FROM visitors;
SELECT * FROM notifications;