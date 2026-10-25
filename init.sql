/*
    Test technique SEFS1026 (Afrikedge) : planification des transports

    Crée la base TransportPlanning, ses tables et un jeu de données de test.
    Le script supprime la base si elle existe déjà : il peut être relancé pour repartir de zéro.

    Les dates des ordres de transport sont calculées à partir de la date du jour,
    pour que les données restent cohérentes quel que soit le jour d'exécution.
*/

SET NOCOUNT ON;
USE master;
GO

IF DB_ID(N'TransportPlanning') IS NOT NULL
BEGIN
    ALTER DATABASE TransportPlanning SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE TransportPlanning;
END
GO

CREATE DATABASE TransportPlanning;
GO

USE TransportPlanning;
GO

/* ------------------------------------------------------------------ Tables */

CREATE TABLE [Sales Order] (
    [No_]               nvarchar(20)  NOT NULL,
    [Customer No_]      nvarchar(20)  NOT NULL,
    [Customer Name]     nvarchar(100) NOT NULL,
    [Delivery City]     nvarchar(50)  NOT NULL,
    [Total Weight (kg)] decimal(10,2) NOT NULL,
    [Status]            tinyint       NOT NULL CONSTRAINT [DF_Sales Order_Status] DEFAULT (0),
    CONSTRAINT [PK_Sales Order] PRIMARY KEY ([No_])
);

CREATE TABLE [Vehicle] (
    [Code]          nvarchar(20)  NOT NULL,
    [Plate No_]     nvarchar(20)  NOT NULL,
    [Capacity (kg)] decimal(10,2) NOT NULL,
    [Active]        bit           NOT NULL CONSTRAINT [DF_Vehicle_Active] DEFAULT (1),
    CONSTRAINT [PK_Vehicle] PRIMARY KEY ([Code])
);

CREATE TABLE [Transport Order] (
    [No_]           nvarchar(20) NOT NULL,
    [Vehicle Code]  nvarchar(20) NOT NULL,
    [Delivery Date] date         NOT NULL,
    [Status]        tinyint      NOT NULL CONSTRAINT [DF_Transport Order_Status] DEFAULT (0),
    [Created By]    nvarchar(50) NOT NULL,
    [Validated By]  nvarchar(50) NULL,
    [timestamp]     rowversion   NOT NULL,
    CONSTRAINT [PK_Transport Order] PRIMARY KEY ([No_])
);

CREATE TABLE [Transport Order Line] (
    [Transport Order No_] nvarchar(20) NOT NULL,
    [Sales Order No_]     nvarchar(20) NOT NULL,
    CONSTRAINT [PK_Transport Order Line] PRIMARY KEY ([Transport Order No_], [Sales Order No_])
);
GO

/* ------------------------------------------------------------- Véhicules */
/* Un véhicule hors service : VH-07. */

INSERT INTO [Vehicle] ([Code], [Plate No_], [Capacity (kg)], [Active]) VALUES
    (N'VH-01', N'LT-482-AB',  1500.00, 1),
    (N'VH-02', N'LT-219-CD',  2500.00, 1),
    (N'VH-03', N'CE-731-EF',  3500.00, 1),
    (N'VH-04', N'LT-905-GH',  5000.00, 1),
    (N'VH-05', N'OU-144-JK',  5000.00, 1),
    (N'VH-06', N'CE-562-LM',  8000.00, 1),
    (N'VH-07', N'LT-377-NP',  3500.00, 0),
    (N'VH-08', N'SU-628-QR', 10000.00, 1),
    (N'VH-09', N'LT-810-ST',  1200.00, 1),
    (N'VH-10', N'CE-093-UV',  2000.00, 1);

/* ------------------------------------------------------ Commandes de vente */
/* Status : 0 = À planifier, 1 = Planifiée, 2 = En livraison */

INSERT INTO [Sales Order] ([No_], [Customer No_], [Customer Name], [Delivery City], [Total Weight (kg)], [Status]) VALUES
    (N'SO-1001', N'C0001', N'Quincaillerie Ndokoti',             N'Douala',     850.00, 2),
    (N'SO-1002', N'C0002', N'Supermarché Akwa Centre',           N'Douala',    1200.00, 2),
    (N'SO-1003', N'C0003', N'Pharmacie du Plateau',              N'Yaoundé',   1100.00, 1),
    (N'SO-1004', N'C0004', N'Boulangerie La Bonne Miche',        N'Yaoundé',    950.00, 1),
    (N'SO-1005', N'C0005', N'Établissements Fotso et Fils',      N'Yaoundé',   1300.00, 1),
    (N'SO-1006', N'C0006', N'Agro Distribution Ouest',           N'Bafoussam',  640.00, 1),
    (N'SO-1007', N'C0007', N'Café Mont Bamboutos',               N'Bafoussam',  720.00, 1),
    (N'SO-1008', N'C0001', N'Quincaillerie Ndokoti',             N'Douala',     430.00, 0),
    (N'SO-1009', N'C0008', N'Hôtel Kribi Plage',                 N'Kribi',      380.00, 0),
    (N'SO-1010', N'C0009', N'Matériaux Sanaga',                  N'Edéa',      2800.00, 0),
    (N'SO-1011', N'C0010', N'Librairie des Écoles',              N'Douala',     260.00, 0),
    (N'SO-1012', N'C0011', N'Station Limbé Marine',              N'Limbé',     1750.00, 0),
    (N'SO-1013', N'C0012', N'Clinique Bonamoussadi',             N'Douala',     145.50, 0),
    (N'SO-1014', N'C0002', N'Supermarché Akwa Centre',           N'Douala',    1980.00, 0),
    (N'SO-1015', N'C0003', N'Pharmacie du Plateau',              N'Yaoundé',    310.75, 0),
    (N'SO-1016', N'C0013', N'Ferme Avicole des Hauts Plateaux',  N'Bafoussam', 2250.00, 0),
    (N'SO-1017', N'C0014', N'Restaurant Le Wouri',               N'Douala',      95.00, 0),
    (N'SO-1018', N'C0009', N'Matériaux Sanaga',                  N'Edéa',      4600.00, 0),
    (N'SO-1019', N'C0015', N'Grossiste Mokolo',                  N'Yaoundé',   3200.00, 0),
    (N'SO-1020', N'C0008', N'Hôtel Kribi Plage',                 N'Kribi',      520.00, 0),
    (N'SO-1021', N'C0016', N'Pêcherie de Limbé',                 N'Limbé',      880.00, 0),
    (N'SO-1022', N'C0004', N'Boulangerie La Bonne Miche',        N'Yaoundé',    410.00, 0),
    (N'SO-1023', N'C0017', N'Briqueterie de Bonabéri',           N'Douala',    6500.00, 0),
    (N'SO-1024', N'C0010', N'Librairie des Écoles',              N'Douala',     180.00, 0),
    (N'SO-1025', N'C0006', N'Agro Distribution Ouest',           N'Bafoussam', 1340.00, 0),
    (N'SO-1026', N'C0018', N'Supérette Bastos',                  N'Yaoundé',    225.00, 0),
    (N'SO-1027', N'C0012', N'Clinique Bonamoussadi',             N'Douala',      60.25, 0),
    (N'SO-1028', N'C0019', N'Comptoir Maritime de Kribi',        N'Kribi',     1475.00, 0),
    (N'SO-1029', N'C0005', N'Établissements Fotso et Fils',      N'Yaoundé',    990.00, 0),
    (N'SO-1030', N'C0020', N'Garage Central Edéa',               N'Edéa',       735.00, 0),
    (N'SO-1031', N'C0014', N'Restaurant Le Wouri',               N'Douala',     140.00, 0),
    (N'SO-1032', N'C0011', N'Station Limbé Marine',              N'Limbé',     2100.00, 0),
    (N'SO-1033', N'C0015', N'Grossiste Mokolo',                  N'Yaoundé',   2650.00, 0),
    (N'SO-1034', N'C0007', N'Café Mont Bamboutos',               N'Bafoussam',  560.00, 0),
    (N'SO-1035', N'C0002', N'Supermarché Akwa Centre',           N'Douala',    1125.00, 0),
    (N'SO-1036', N'C0013', N'Ferme Avicole des Hauts Plateaux',  N'Bafoussam', 3800.00, 0),
    (N'SO-1037', N'C0016', N'Pêcherie de Limbé',                 N'Limbé',      330.00, 0),
    (N'SO-1038', N'C0019', N'Comptoir Maritime de Kribi',        N'Kribi',      270.00, 0),
    (N'SO-1039', N'C0001', N'Quincaillerie Ndokoti',             N'Douala',    1560.00, 0),
    (N'SO-1040', N'C0018', N'Supérette Bastos',                  N'Yaoundé',     85.00, 0);

/* ---------------------------------------------------- Ordres de transport */
/*
    TO-0001  Parti      VH-02, il y a 3 jours, 2 commandes (2 050 kg sur 2 500 kg)
    TO-0002  Validé     VH-03, demain,         3 commandes (3 350 kg sur 3 500 kg)
    TO-0003  Brouillon  VH-01, demain,         2 commandes (1 360 kg sur 1 500 kg)
    TO-0004  Brouillon  VH-04, après-demain,   aucune commande
    Status : 0 = Brouillon, 1 = Validé, 2 = Parti
*/

DECLARE @Today date = CAST(GETDATE() AS date);

INSERT INTO [Transport Order] ([No_], [Vehicle Code], [Delivery Date], [Status], [Created By], [Validated By]) VALUES
    (N'TO-0001', N'VH-02', DATEADD(day, -3, @Today), 2, N'diane', N'eric'),
    (N'TO-0002', N'VH-03', DATEADD(day,  1, @Today), 1, N'diane', N'eric'),
    (N'TO-0003', N'VH-01', DATEADD(day,  1, @Today), 0, N'diane', NULL),
    (N'TO-0004', N'VH-04', DATEADD(day,  2, @Today), 0, N'eric',  NULL);

INSERT INTO [Transport Order Line] ([Transport Order No_], [Sales Order No_]) VALUES
    (N'TO-0001', N'SO-1001'),
    (N'TO-0001', N'SO-1002'),
    (N'TO-0002', N'SO-1003'),
    (N'TO-0002', N'SO-1004'),
    (N'TO-0002', N'SO-1005'),
    (N'TO-0003', N'SO-1006'),
    (N'TO-0003', N'SO-1007');
GO

/* ------------------------------------------------------------- Contrôle */

SELECT N'Vehicle' AS [Table], COUNT(*) AS [Lignes] FROM [Vehicle]
UNION ALL SELECT N'Sales Order', COUNT(*) FROM [Sales Order]
UNION ALL SELECT N'Transport Order', COUNT(*) FROM [Transport Order]
UNION ALL SELECT N'Transport Order Line', COUNT(*) FROM [Transport Order Line];
GO
