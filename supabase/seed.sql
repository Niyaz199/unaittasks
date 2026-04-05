-- Demo seed for the refactored PPR module.
-- Targets schema after migrations `0021_global_room_directories.sql`
-- (including global floor and room type directories).
--
-- Before running:
-- 1. The database must already contain profiles in `public.profiles`.
-- 2. It is enough to have at least:
--    - one `admin`
--    - one responsible candidate from (`lead`, `engineer`, `object_engineer`)
--    - one executor candidate from (`engineer`, `object_engineer`, `tech`)

do $$
declare
  v_admin_id uuid;
  v_lead_id uuid;
  v_engineer_id uuid;
  v_object_engineer_id uuid;
  v_tech_id uuid;
  v_current_month date := date_trunc('month', current_date)::date;
  v_next_month date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_task_id uuid;
  v_status text;
  v_assignee_id uuid;
  v_checklist jsonb;
  task_seed record;
  work_item record;
begin
  select id into v_admin_id
  from public.profiles
  where role = 'admin'
  order by created_at
  limit 1;

  select id into v_lead_id
  from public.profiles
  where role in ('lead', 'engineer', 'object_engineer')
  order by case role when 'lead' then 1 when 'engineer' then 2 else 3 end, created_at
  limit 1;

  select id into v_engineer_id
  from public.profiles
  where role in ('engineer', 'object_engineer', 'lead')
  order by case role when 'engineer' then 1 when 'object_engineer' then 2 else 3 end, created_at
  limit 1;

  select id into v_object_engineer_id
  from public.profiles
  where role in ('object_engineer', 'engineer', 'lead')
  order by case role when 'object_engineer' then 1 when 'engineer' then 2 else 3 end, created_at
  limit 1;

  select id into v_tech_id
  from public.profiles
  where role in ('tech', 'engineer', 'object_engineer')
  order by case role when 'tech' then 1 when 'engineer' then 2 else 3 end, created_at
  limit 1;

  if v_admin_id is null then
    raise exception 'Demo seed requires at least one admin profile';
  end if;

  if v_lead_id is null then
    raise exception 'Demo seed requires at least one responsible user: lead/engineer/object_engineer';
  end if;

  if v_engineer_id is null or v_object_engineer_id is null or v_tech_id is null then
    raise exception 'Demo seed requires executor candidates: engineer/object_engineer/tech';
  end if;

  delete from public.objects
  where id in (
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  );

  delete from public.ppr_system_groups
  where id in (
    '30000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000002'::uuid,
    '30000000-0000-4000-8000-000000000003'::uuid,
    '30000000-0000-4000-8000-000000000004'::uuid,
    '30000000-0000-4000-8000-000000000005'::uuid
  );

  delete from public.room_types
  where id in (
    '32000000-0000-4000-8000-000000000001'::uuid,
    '32000000-0000-4000-8000-000000000002'::uuid,
    '32000000-0000-4000-8000-000000000003'::uuid,
    '32000000-0000-4000-8000-000000000004'::uuid,
    '32000000-0000-4000-8000-000000000005'::uuid,
    '32000000-0000-4000-8000-000000000006'::uuid,
    '32000000-0000-4000-8000-000000000007'::uuid
  );

  insert into public.ppr_system_groups (id, name, code, is_active)
  values
    ('30000000-0000-4000-8000-000000000001', 'DEMO HVAC', 'DEMO-HVAC', true),
    ('30000000-0000-4000-8000-000000000002', 'DEMO Cooling', 'DEMO-COOL', true),
    ('30000000-0000-4000-8000-000000000003', 'DEMO Fire Safety', 'DEMO-FIRE', true),
    ('30000000-0000-4000-8000-000000000004', 'DEMO Power', 'DEMO-POWER', true),
    ('30000000-0000-4000-8000-000000000005', 'DEMO Security', 'DEMO-SEC', true);

  insert into public.room_types (id, name, description, sort_order, is_active)
  values
    ('32000000-0000-4000-8000-000000000001', 'Серверная', 'Помещения серверных и ЦОД-залов', 10, true),
    ('32000000-0000-4000-8000-000000000002', 'Машзал', 'Технические машинные помещения', 20, true),
    ('32000000-0000-4000-8000-000000000003', 'Электрощитовая', 'Щитовые, ИБП и силовые помещения', 30, true),
    ('32000000-0000-4000-8000-000000000004', 'Склад', 'Складские и логистические зоны', 40, true),
    ('32000000-0000-4000-8000-000000000005', 'КПП', 'Посты охраны и проходные', 50, true),
    ('32000000-0000-4000-8000-000000000006', 'Холодильная камера', 'Помещения с поддержанием температурного режима', 60, true),
    ('32000000-0000-4000-8000-000000000007', 'Техническое помещение', 'Общее техническое помещение без более узкого типа', 70, true);

  insert into public.objects (id, name, created_by, object_engineer_id)
  values
    ('11111111-1111-4111-8111-111111111111', 'DEMO ЦОД Север', v_admin_id, v_object_engineer_id),
    ('22222222-2222-4222-8222-222222222222', 'DEMO Склад Южный', v_admin_id, v_object_engineer_id);

  insert into public.user_objects (user_id, object_id)
  values
    (v_lead_id, '11111111-1111-4111-8111-111111111111'),
    (v_lead_id, '22222222-2222-4222-8222-222222222222'),
    (v_engineer_id, '11111111-1111-4111-8111-111111111111'),
    (v_engineer_id, '22222222-2222-4222-8222-222222222222'),
    (v_object_engineer_id, '11111111-1111-4111-8111-111111111111'),
    (v_object_engineer_id, '22222222-2222-4222-8222-222222222222'),
    (v_tech_id, '11111111-1111-4111-8111-111111111111'),
    (v_tech_id, '22222222-2222-4222-8222-222222222222')
  on conflict do nothing;

  insert into public.floors (id, object_id, name, sort_order, is_active)
  values
    ('61000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '1', 100, true),
    ('61000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2', 200, true),
    ('61000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', '1', 100, true);

  insert into public.ppr_systems (id, object_id, system_group_id, name, description, responsible_user_id, is_active)
  values
    ('41000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000001', 'Приточно-вытяжная вентиляция', 'Вентиляция машзалов и серверных', v_lead_id, true),
    ('41000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000002', 'Холодоснабжение', 'Чиллеры и насосные группы ЦОД', v_engineer_id, true),
    ('41000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', '30000000-0000-4000-8000-000000000003', 'Пожарная сигнализация', 'Пожарные панели и извещатели', v_object_engineer_id, true),
    ('41000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', '30000000-0000-4000-8000-000000000001', 'Складская вентиляция', 'Вентиляция складских зон', v_lead_id, true),
    ('41000000-0000-4000-8000-000000000005', '22222222-2222-4222-8222-222222222222', '30000000-0000-4000-8000-000000000004', 'Электроснабжение', 'Щиты, АВР, ИБП склада', v_engineer_id, true),
    ('41000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', '30000000-0000-4000-8000-000000000005', 'СКУД', 'Контроль доступа и турникеты', v_object_engineer_id, true);

  insert into public.object_rooms (id, object_id, name, floor, floor_id, room_type_id, description, is_active)
  values
    ('51000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Серверная А', '1', '61000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000001', 'Основной зал серверов', true),
    ('51000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Машзал 1', '1', '61000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000002', 'Приточные установки', true),
    ('51000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'Машзал 2', '2', '61000000-0000-4000-8000-000000000002', '32000000-0000-4000-8000-000000000002', 'Чиллерная группа', true),
    ('51000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'ИБП', '1', '61000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000003', 'Помещение ИБП и аккумуляторов', true),
    ('51000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'Щитовая А', '1', '61000000-0000-4000-8000-000000000001', '32000000-0000-4000-8000-000000000003', 'Щитовая и пульт ПС', true),
    ('51000000-0000-4000-8000-000000000006', '22222222-2222-4222-8222-222222222222', 'Склад 1', '1', '61000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000004', 'Основная складская зона', true),
    ('51000000-0000-4000-8000-000000000007', '22222222-2222-4222-8222-222222222222', 'Склад 2', '1', '61000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000004', 'Дополнительная складская зона', true),
    ('51000000-0000-4000-8000-000000000008', '22222222-2222-4222-8222-222222222222', 'Электрощитовая', '1', '61000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000003', 'Силовые шкафы и АВР', true),
    ('51000000-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'КПП', '1', '61000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000005', 'Точка доступа персонала', true),
    ('51000000-0000-4000-8000-000000000010', '22222222-2222-4222-8222-222222222222', 'Холодильная камера', '1', '61000000-0000-4000-8000-000000000003', '32000000-0000-4000-8000-000000000006', 'Камера хранения температурного режима', true);

  create temp table tmp_equipment_seed (
    object_id uuid,
    system_id uuid,
    room_id uuid,
    inventory_no text,
    name text,
    dispatch_name text,
    service_start_date date,
    status text,
    serial_no text,
    manufacturer text,
    model text,
    description text,
    comment text
  ) on commit drop;

  insert into tmp_equipment_seed values
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','DEMO-PPR-VENT-01','Приточная установка П1','П1','2020-02-15','active','VNT-0001','Systemair','Geniox-42','Приточная установка машзала 1',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000002','DEMO-PPR-VENT-02','Вытяжная установка В1','В1','2020-03-10','active','VNT-0002','Systemair','Geniox-35','Вытяжная установка машзала 1',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','DEMO-PPR-VENT-03','Прецизионный кондиционер PC-1','PC-1','2021-04-12','repair','VNT-0003','Stulz','CyberAir-3','Охлаждение серверной А','Требует проверки фильтров'),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','DEMO-PPR-VENT-04','Клапан огнезадерживающий KO-1','KO-1','2022-01-20','active','VNT-0004','Belimo','FSL24','Огнезадерживающий клапан серверной',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','DEMO-PPR-COOL-01','Чиллер CH-1','CH-1','2019-06-01','active','COL-0001','Clint','CHA-451','Основной чиллер ЦОД',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','DEMO-PPR-COOL-02','Чиллер CH-2','CH-2','2019-06-01','active','COL-0002','Clint','CHA-451','Резервный чиллер ЦОД',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','DEMO-PPR-COOL-03','Насосная группа NG-1','NG-1','2020-09-14','active','COL-0003','Grundfos','NB-65','Подающая насосная группа',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000003','DEMO-PPR-COOL-04','Теплообменник ТО-1','ТО-1','2021-05-25','out_of_service','COL-0004','Alfa Laval','M10','Пластинчатый теплообменник','Временно выведен из эксплуатации'),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000005','DEMO-PPR-FIRE-01','Панель ПС-1','PS-1','2021-02-08','active','FIR-0001','Bolid','С2000М','Центральная панель пожарной сигнализации',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000001','DEMO-PPR-FIRE-02','Дымовой извещатель DI-1','DI-1','2022-07-17','active','FIR-0002','Bolid','ДИП-34А','Извещатель серверной А',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000002','DEMO-PPR-FIRE-03','Дымовой извещатель DI-2','DI-2','2022-07-17','active','FIR-0003','Bolid','ДИП-34А','Извещатель машзала 1',null),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000004','DEMO-PPR-FIRE-04','Оповещатель OP-1','OP-1','2022-07-17','active','FIR-0004','Bolid','ОПОП-124','Светозвуковой оповещатель ИБП',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000006','DEMO-PPR-SVENT-01','Приточная установка СК-П1','СК-П1','2020-04-03','active','SVN-0001','VentMachine','Colibri-1000','Приточная установка склада 1',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000007','DEMO-PPR-SVENT-02','Вытяжная установка СК-В1','СК-В1','2020-04-03','active','SVN-0002','VentMachine','Colibri-1000','Вытяжная установка склада 2',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000010','DEMO-PPR-SVENT-03','Канальный вентилятор KV-1','KV-1','2021-01-11','active','SVN-0003','Ostberg','CK-160','Вентиляция холодильной камеры',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000010','DEMO-PPR-SVENT-04','Воздушная завеса VZ-1','VZ-1','2021-10-15','active','SVN-0004','Ballu','BHC-M15','Завеса погрузочной зоны',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000008','DEMO-PPR-POWER-01','ВРУ ВР-1','ВР-1','2018-03-19','active','PWR-0001','Schneider Electric','Prisma','Вводно-распределительное устройство',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000008','DEMO-PPR-POWER-02','Щит АВР AVR-1','AVR-1','2019-09-09','active','PWR-0002','ABB','ATS','Щит автоматического ввода резерва',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000008','DEMO-PPR-POWER-03','ИБП UPS-1','UPS-1','2020-05-27','active','PWR-0003','Eaton','93E','ИБП складского контура',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000008','DEMO-PPR-POWER-04','Щит освещения ЩО-1','ЩО-1','2021-12-04','archived','PWR-0004','IEK','ЩО-36','Старый щит освещения','Снят с эксплуатации'),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000009','DEMO-PPR-ACS-01','Контроллер доступа KD-1','KD-1','2021-03-05','active','ACS-0001','RusGuard','RG-2','Контроллер проходной',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000009','DEMO-PPR-ACS-02','Считыватель карт SK-1','SK-1','2021-03-05','active','ACS-0002','IronLogic','Z-2','Считыватель на КПП',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000009','DEMO-PPR-ACS-03','Электромагнитный замок EZ-1','EZ-1','2021-03-05','active','ACS-0003','AccordTec','ML-295K','Замок двери КПП',null),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000009','DEMO-PPR-ACS-04','Турникет TR-1','TR-1','2022-08-30','active','ACS-0004','PERCo','TTR-08','Турникет проходной',null);

  insert into public.ppr_equipment (
    object_id,
    system_id,
    room_id,
    inventory_no,
    name,
    dispatch_name,
    service_start_date,
    status,
    serial_no,
    manufacturer,
    model,
    description,
    comment
  )
  select
    object_id,
    system_id,
    room_id,
    inventory_no,
    name,
    dispatch_name,
    service_start_date,
    status,
    serial_no,
    manufacturer,
    model,
    description,
    comment
  from tmp_equipment_seed;

  create temp table tmp_template_seed (
    object_id uuid,
    system_id uuid,
    name text,
    period_months integer,
    base_start_date date,
    norm_hours numeric(10,2),
    methodology text
  ) on commit drop;

  insert into tmp_template_seed values
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000001','Замена фильтров и ремней вентиляции',3,v_current_month - interval '9 months',4.0,'Остановить установку, заменить фильтры и проверить ременную передачу'),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000001','Проверка автоматики вентиляции',6,v_current_month - interval '12 months',2.5,'Проверить датчики, уставки и работу автоматики'),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000002','Проверка холодильного контура',3,v_current_month - interval '9 months',5.0,'Контроль давления, температуры и утечек'),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000002','Сервис насосной группы',6,v_current_month - interval '12 months',3.5,'Проверка насосов, арматуры и вибрации'),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000003','Тест пожарной панели',1,v_current_month - interval '4 months',1.5,'Прогон самодиагностики и тест зон'),
    ('11111111-1111-4111-8111-111111111111','41000000-0000-4000-8000-000000000003','Осмотр извещателей и оповещателей',3,v_current_month - interval '9 months',2.0,'Осмотр креплений, загрязнений и индикации'),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000004','Проверка складской вентиляции',3,v_current_month - interval '6 months',2.5,'Осмотр вентиляторов, фильтров и заслонок'),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000004','Сервис воздушных завес',6,v_current_month - interval '12 months',2.0,'Проверка двигателей и термозащиты'),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000005','Осмотр силовых шкафов',1,v_current_month - interval '3 months',1.5,'Термография и протяжка контактных соединений'),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000005','Проверка ИБП и АВР',6,v_current_month - interval '12 months',3.0,'Тест переключения и диагностика ИБП'),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000006','Тест контроллеров СКУД',1,v_current_month - interval '3 months',1.0,'Проверка связи, логов и питания'),
    ('22222222-2222-4222-8222-222222222222','41000000-0000-4000-8000-000000000006','Осмотр замков и турникетов',3,v_current_month - interval '9 months',1.5,'Проверка исполнительных механизмов и датчиков');

  insert into public.ppr_work_templates (
    object_id,
    system_id,
    name,
    description,
    period_months,
    base_start_date,
    norm_hours,
    methodology,
    is_active
  )
  select
    object_id,
    system_id,
    name,
    format('DEMO шаблон: %s', name),
    period_months,
    base_start_date,
    norm_hours,
    methodology,
    true
  from tmp_template_seed;

  insert into public.ppr_work_checklist_items (object_id, template_id, sort_order, title, description)
  select t.object_id, t.id, 1, 'Визуальный осмотр', 'Проверить внешний вид, крепления и маркировку'
  from public.ppr_work_templates t
  where t.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid);

  insert into public.ppr_work_checklist_items (object_id, template_id, sort_order, title, description)
  select t.object_id, t.id, 2, 'Проверка работоспособности', 'Проверить базовые режимы работы и индикацию'
  from public.ppr_work_templates t
  where t.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid);

  insert into public.ppr_work_checklist_items (object_id, template_id, sort_order, title, description)
  select t.object_id, t.id, 3, 'Фиксация результата', 'Записать замечания и итог проверки'
  from public.ppr_work_templates t
  where t.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid);

  insert into public.ppr_month_plans (object_id, system_id, plan_month, generated_at)
  select s.object_id, s.id, v_current_month, now() - interval '1 day'
  from public.ppr_systems s
  where s.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid);

  insert into public.ppr_month_plans (object_id, system_id, plan_month, generated_at)
  select s.object_id, s.id, v_next_month, now()
  from public.ppr_systems s
  where s.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid);

  insert into public.ppr_month_plan_items (
    object_id,
    month_plan_id,
    system_id,
    equipment_id,
    template_id,
    planned_for,
    source_due_date,
    is_overdue,
    is_carried_over,
    task_id,
    status
  )
  select
    e.object_id,
    mp.id,
    e.system_id,
    e.id,
    t.id,
    (v_current_month + ((((dense_rank() over (order by e.inventory_no, t.name)) - 1) % 20)::int))::date as planned_for,
    (v_current_month + ((((dense_rank() over (order by e.inventory_no, t.name)) - 1) % 20)::int))::date as source_due_date,
    ((v_current_month + ((((dense_rank() over (order by e.inventory_no, t.name)) - 1) % 20)::int))::date < current_date),
    false,
    null,
    'pending'
  from public.ppr_equipment e
  join public.ppr_work_templates t on t.object_id = e.object_id and t.system_id = e.system_id
  join public.ppr_month_plans mp on mp.object_id = e.object_id and mp.system_id = e.system_id and mp.plan_month = v_current_month
  where e.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid)
    and e.status = 'active'
    and t.is_active = true
    and e.service_start_date <= (v_current_month + interval '1 month' - interval '1 day')::date;

  insert into public.ppr_month_plan_items (
    object_id,
    month_plan_id,
    system_id,
    equipment_id,
    template_id,
    planned_for,
    source_due_date,
    is_overdue,
    is_carried_over,
    task_id,
    status
  )
  select
    e.object_id,
    mp.id,
    e.system_id,
    e.id,
    t.id,
    (v_next_month + ((((dense_rank() over (order by e.inventory_no, t.name)) - 1) % 20)::int))::date as planned_for,
    (v_next_month + ((((dense_rank() over (order by e.inventory_no, t.name)) - 1) % 20)::int))::date as source_due_date,
    false,
    false,
    null,
    'pending'
  from public.ppr_equipment e
  join public.ppr_work_templates t on t.object_id = e.object_id and t.system_id = e.system_id
  join public.ppr_month_plans mp on mp.object_id = e.object_id and mp.system_id = e.system_id and mp.plan_month = v_next_month
  where e.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid)
    and e.status = 'active'
    and t.is_active = true
    and e.service_start_date <= (v_next_month + interval '1 month' - interval '1 day')::date;

  create temp table tmp_task_seed on commit drop as
  select
    row_number() over (order by src.planned_for, src.inventory_no) as seq,
    src.object_id,
    src.system_id,
    src.equipment_id,
    src.planned_for,
    src.responsible_user_id
  from (
    select distinct
      mpi.object_id,
      mpi.system_id,
      mpi.equipment_id,
      mpi.planned_for,
      e.inventory_no,
      s.responsible_user_id
    from public.ppr_month_plan_items mpi
    join public.ppr_equipment e on e.id = mpi.equipment_id
    join public.ppr_systems s on s.id = mpi.system_id
    join public.ppr_month_plans mp on mp.id = mpi.month_plan_id
    where mpi.object_id in ('11111111-1111-4111-8111-111111111111'::uuid, '22222222-2222-4222-8222-222222222222'::uuid)
      and mp.plan_month = v_current_month
  ) src
  limit 12;

  for task_seed in
    select * from tmp_task_seed order by seq
  loop
    v_status := case (task_seed.seq - 1) % 5
      when 0 then 'new'
      when 1 then 'in_progress'
      when 2 then 'done'
      when 3 then 'closed'
      else 'cancelled'
    end;

    v_assignee_id := case v_status
      when 'new' then v_engineer_id
      when 'in_progress' then v_tech_id
      when 'done' then v_tech_id
      when 'closed' then v_engineer_id
      else v_object_engineer_id
    end;

    insert into public.ppr_tasks (
      object_id,
      system_id,
      equipment_id,
      responsible_user_id,
      assignee_id,
      planned_for,
      completed_at,
      closed_at,
      cancelled_at,
      cancelled_by,
      status,
      is_overdue,
      is_rescheduled,
      general_comment,
      cancel_reason
    )
    values (
      task_seed.object_id,
      task_seed.system_id,
      task_seed.equipment_id,
      task_seed.responsible_user_id,
      v_assignee_id,
      task_seed.planned_for,
      case when v_status in ('done', 'closed') then now() - interval '1 day' else null end,
      case when v_status = 'closed' then now() - interval '12 hours' else null end,
      case when v_status = 'cancelled' then now() - interval '6 hours' else null end,
      case when v_status = 'cancelled' then v_lead_id else null end,
      v_status,
      task_seed.planned_for < current_date,
      false,
      format('DEMO задача ППР для проверки статуса %s', v_status),
      case when v_status = 'cancelled' then 'Отменено для проверки сценария отмены' else null end
    )
    returning id into v_task_id;

    for work_item in
      select
        mpi.id as plan_item_id,
        mpi.object_id,
        mpi.template_id,
        wt.name as template_name,
        wt.description as template_description,
        wt.methodology as template_methodology,
        wt.norm_hours as template_norm_hours
      from public.ppr_month_plan_items mpi
      join public.ppr_work_templates wt on wt.id = mpi.template_id
      join public.ppr_month_plans mp on mp.id = mpi.month_plan_id
      where mpi.equipment_id = task_seed.equipment_id
        and mpi.planned_for = task_seed.planned_for
        and mp.plan_month = v_current_month
      order by wt.name
    loop
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sort_order', ci.sort_order,
            'title', ci.title,
            'description', ci.description
          )
          order by ci.sort_order
        ),
        '[]'::jsonb
      )
      into v_checklist
      from public.ppr_work_checklist_items ci
      where ci.template_id = work_item.template_id;

      insert into public.ppr_task_work_items (
        object_id,
        task_id,
        template_id,
        plan_item_id,
        title_snapshot,
        description_snapshot,
        methodology_snapshot,
        checklist_snapshot,
        norm_hours_snapshot,
        sort_order
      )
      values (
        work_item.object_id,
        v_task_id,
        work_item.template_id,
        work_item.plan_item_id,
        work_item.template_name,
        work_item.template_description,
        work_item.template_methodology,
        v_checklist,
        work_item.template_norm_hours,
        coalesce(
          (
            select max(twi.sort_order) + 1
            from public.ppr_task_work_items twi
            where twi.task_id = v_task_id
          ),
          1
        )
      );

      update public.ppr_month_plan_items
      set
        task_id = v_task_id,
        status = case
          when v_status = 'closed' then 'closed'
          when v_status = 'cancelled' then 'cancelled'
          else 'materialized'
        end
      where id = work_item.plan_item_id;
    end loop;

    if v_status <> 'new' then
      insert into public.ppr_task_comments (object_id, task_id, author_id, body)
      values (
        task_seed.object_id,
        v_task_id,
        v_assignee_id,
        format('DEMO комментарий по задаче со статусом %s', v_status)
      );
    end if;
  end loop;

  raise notice 'PPR demo seed completed successfully';
end;
$$;
