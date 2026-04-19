# Mini check IntelliJ - Run Configuration (Backend + Frontend)

## 1) Verification rapide avant configuration

- Project SDK: `17` (File > Project Structure > Project)
- JDK du module backend: `17`
- Maven project importe: fichier `backend/pom.xml` detecte dans l'onglet Maven
- Node interpreteur actif (Settings > Languages & Frameworks > Node.js)

## 2) Run Config Backend (Spring Boot)

Creer une nouvelle configuration:

- Type: `Spring Boot`
- Name: `Backend (9091)`
- Main class: `org.example.backend.BackendApplication`
- Use classpath of module: `backend`
- Working directory: `$PROJECT_DIR$/backend`
- JRE: `17`
- Active profiles: (laisser vide)
- Program arguments: (laisser vide)
- VM options: (laisser vide)

Environment variables recommandees:

- `SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/yallatn?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true`
- `SPRING_DATASOURCE_USERNAME=root`
- `SPRING_DATASOURCE_PASSWORD=`
- `SPRING_JPA_HIBERNATE_DDL_AUTO=update`

Important:

- Ne pas coller un gros bloc multiline dans le champ Environment variables.
- Ajouter les variables une par une via l'editeur de variables.

## 3) Run Config Frontend (npm)

Creer une nouvelle configuration:

- Type: `npm`
- Name: `Frontend (4200)`
- package.json: `$PROJECT_DIR$/frontend/package.json`
- Command: `run`
- Scripts: `start`
- Arguments: `-- --port 4200`
- Node interpreter: celui configure dans IntelliJ
- Working directory: `$PROJECT_DIR$/frontend`

## 4) Si IntelliJ affiche "module not specified"

- Ouvrir `File > Project Structure > Modules`
- Verifier que le module `backend` existe
- Si absent: clic droit sur `backend/pom.xml` > `Add as Maven Project`
- Reouvrir la Run Configuration et re-selectionner `Use classpath of module = backend`

## 5) Si port occupe (erreurs les plus frequentes)

Backend 9091:

```powershell
Get-NetTCPConnection -LocalPort 9091 -State Listen | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

Frontend 4200:

```powershell
Get-NetTCPConnection -LocalPort 4200 -State Listen | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

## 6) Test final (ordre recommande)

1. Lancer `Backend (9091)` et attendre `Started BackendApplication`.
2. Lancer `Frontend (4200)` et verifier `http://localhost:4200/`.
3. Si l'un tombe, verifier d'abord le port puis la configuration module/classpath.

## 7) Plan B rapide (terminal dans IntelliJ)

Backend:

```powershell
cd $PROJECT_DIR$/backend
.\mvnw.cmd -DskipTests spring-boot:run
```

Frontend:

```powershell
cd $PROJECT_DIR$/frontend
npm run start -- --port 4200
```
