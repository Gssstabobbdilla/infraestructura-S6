# Infraestructura - Semana 6
## Terraform + AWS Lambda

1. Deben realizar el código del diagrama que se está adjuntando como archivo mermaid. 

2. La arquitectura debe poder desplegarse en 3 entornos: DEV, QA y PROD.

 

3. Lo que no esté considerado en el diagrama se puede cambiar/modificar.

 

4. Deben adjuntar un PDF incluyendo capturas de que se encuentra desplegado en su cuenta de AWS (evidenciar datos de la cuenta) y el URL de su proyecto con instrucciones de README.md.

5. Deben evidenciar haber destruido los recursos (terraform destroy*)

### Diagrama

El flujo previsto es el siguiente:

1. **API Gateway HTTP APi:**: Exppone un endpont HTTP publico para recibir solicitudes de carga de imágenes
2. **Upload Lambda:** Recibe la imagen desde la API y la guarda en el bucket S3 bajo el prefijo `uploads/`.
3. **Notificación de S3:**: Xuando se crea un objeto bajo `uploads/`, S3 publica un mensaje en la cola SQS.
4. **Amazon SQS:** Conserva temporalmente los mensajes y desacopla la carga del procesamiento. Oara que la lambda crop puede procesar los trabajos de manera asíncrona.
5. **Crop Lambda:** Se activa con los mensajes de SQS, descarga la imagen, aplica un recorte circular y guarda el resultado en `processed/`
6. **VPC Endpoints:** Permiten que las Lambdas se comuniquen con S3 (Gateway Endpoint) y SQS (Interface Endpoint)


![Diagrama del trabajo](imagenes/DIAGRAMA.png)

### Requisitos
- Terraform 1.5 o superior instalado
- Cuenta de AWS
- AWS CLI v2 y perfil SSO propio para desplegar

### Manejo de entornos

| Entorno | Workspace | VPC | Privadas A / B | Publicas A / B |
|---|---|---|---|---|
| DEV | `dev` | `10.0.0.0/16` | `10.0.11.0/24` / `10.0.12.0/24` | `10.0.1.0/24` / `10.0.2.0/24` |
| QA | `qa` | `10.1.0.0/16` | `10.1.11.0/24` / `10.1.12.0/24` | `10.1.1.0/24` / `10.1.2.0/24` |
| PROD | `prod` | `10.2.0.0/16` | `10.2.11.0/24` / `10.2.12.0/24` | `10.2.1.0/24` / `10.2.2.0/24` |

`iac/environments.tf` selecciona la VPC automaticamente y calcula las subredes.
No hace falta pasar un archivo de variables por entorno. Los nombres de los
recursos incluyen el workspace y cada uno conserva un estado independiente.
La configuracion bloquea desplegar desde `default` u otros nombres de workspace.

## Configuración de Terraform

Los archivos Terraform se encuentran en el directorio `iac/`. Primero construir
los ZIP de las Lambdas como se indica mas abajo. Luego inicializar Terraform
y seleccionar o crear el workspace:

```bash
cd iac
terraform init
terraform workspace select -or-create dev
terraform workspace show
```

Repetir usando `qa` o `prod` para los otros entornos. Cambiar de workspace no
elimina los recursos del anterior ni copia su estado.

El estado es local en este laboratorio y esta excluido de Git. Un workspace
con el mismo nombre en otra computadora no comparte automaticamente ese estado.
El integrante que despliega debe conservarlo y encargarse de las operaciones
posteriores sobre esos recursos, incluida su destruccion.

### Configuración de proveedores

Cada integrante usa su propio perfil local; no hay un perfil personal fijado en
el codigo. Configurarlo con `aws configure sso` y autenticarse en el navegador.
En PowerShell, reemplazar `TU_PERFIL` por el nombre realmente configurado:

```powershell
$env:AWS_PROFILE = "TU_PERFIL"
aws sso login --profile $env:AWS_PROFILE
aws sts get-caller-identity --profile $env:AWS_PROFILE
```

La region de SSO es la de IAM Identity Center; los recursos de este proyecto
se despliegan por defecto en `us-east-1`. Pueden ser regiones distintas.
El nombre de usuario SSO no tiene que coincidir con el nombre del perfil CLI.

#### AWS

El proveedor AWS usa una región y un perfil local de AWS CLI. La configuración del proyecto está en [`iac/providers.tf`](iac/providers.tf):

```hcl
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}
```

`aws_profile` tiene valor `null` por defecto, por lo que el proveedor utiliza
`AWS_PROFILE` o las credenciales estandar disponibles. Tambien puede indicarse
explicitamente con `-var="aws_profile=TU_PERFIL"`. No guardar credenciales ni
tokens en el repositorio.

### Desplegar y destruir cada entorno

Desde `iac/`, con el perfil autenticado y los ZIP construidos:

```powershell
terraform workspace select -or-create dev
terraform validate
terraform plan
terraform apply
terraform output
```

Antes de aceptar `apply`, comprobar el workspace activo, la cuenta mostrada por
`aws sts get-caller-identity` y los cambios del plan. Ejecutar las pruebas de
carga y recorte documentadas mas abajo y guardar las capturas reales para la
entrega. Repetir en `qa` y `prod` cuando corresponda.

Para destruir, seleccionar el mismo workspace que se desplego, mantener el
mismo perfil/cuenta y ejecutar:

```powershell
terraform workspace select dev
terraform plan -destroy
terraform destroy
terraform state list
```

Confirmar la destruccion solo despues de revisar el plan. El bucket utiliza
`force_destroy = true`: tambien se eliminan sus objetos. Tras finalizar, la
lista de recursos del estado debe estar vacia. Conservar capturas de la
destruccion. Repetir para cada entorno que se haya desplegado.

## Recursos configurados

### Amazon S3

La configuración del bucket de imágenes está en [`iac/s3.tf`](iac/s3.tf). El nombre se construye usando `project_name`, el workspace activo y el sufijo `iac-images`.

- **Versionado:** Mantiene versiones anteriores de los objetos.
- **Cifrado:** Habilita cifrado del lado del servidor con AES-256.
- **Acceso público:** Totalmente privado
- **Ciclo de vida:** Programa la expiración de objetos bajo `uploads/` a los 30 días y bajo `processed/` a los 90 días. 
- **Destrucción:** `force_destroy = true` permite que Terraform elimine el bucket aunque contenga objetos. 

### Amazon SQS

La configuración de las colas está en [`iac/sqs.tf`](iac/sqs.tf)

- **Cola principal:** Usa long polling de 20 segundos, retiene mensajes por un día y mantiene cada mensaje invisible durante seis minutos después de recibirlo.
- **Cola de mensajes fallidos:** Retiene mensajes por 14 días.
- **Redrive:** Después de tres recepciones sin completar correctamente el procesamiento, SQS mueve el mensaje a la DLQ.
- **Cifrado:** Cifrado administrado por SQS.

### Lambdas: codigo, pruebas y empaquetado

El codigo esta en `lambdas/upload/index.js` y `lambdas/crop/index.js`.
Terraform define ambas funciones en `iac/lambda.tf`, con los roles IAM y las
dos subredes privadas. Upload usa 256 MB y 30 segundos; crop usa 512 MB y
60 segundos. Los nombres coinciden con los grupos de logs existentes.

Se usa Node.js 22 porque Node.js 20, indicado en el diagrama, ya no esta en
la lista de runtimes soportados de AWS Lambda. Las dependencias se fijan en
`lambdas/package-lock.json`.

Requisitos adicionales: Node.js 22 o superior, npm y Python 3. Antes de ejecutar
`terraform plan` o `terraform apply`, construir los ZIP:

```bash
cd lambdas
npm ci
npm test
python build.py
cd ../iac
terraform validate
```

En PowerShell puede utilizarse `npm.cmd` si la politica de ejecucion bloquea
`npm.ps1`. El empaquetador instala dependencias para **Linux x86_64 con glibc**
en una carpeta independiente y genera `.build/upload.zip` y `.build/crop.zip`.
No debe subirse `node_modules` de Windows como paquete para Lambda. Los ZIP
generados y `node_modules` estan excluidos de Git.

Upload acepta un formulario multipart con un unico archivo llamado `image`,
o JSON con el campo `imageBase64`. Valida que los bytes correspondan a JPG,
PNG, GIF o WebP y devuelve HTTP 202 con las claves del original y del resultado
esperado. Un GIF animado se procesa usando su primer fotograma.

**Limite de carga directa: 4 MiB.** El diagrama propone 10 MB, pero Lambda
limita las invocaciones sincronas a 6 MB y base64 aumenta el tamano del archivo.
Para admitir originales de 10 MB se necesitaria un flujo de carga directa a S3
con URL prefirmada. Esta implementacion limita tambien las imagenes a 40 millones
de pixeles para controlar la memoria utilizada al procesarlas.

Crop interpreta notificaciones S3 dentro de los mensajes SQS, guarda un PNG
circular de 40x40 con transparencia en `processed/` y devuelve los identificadores
de mensajes fallidos mediante `batchItemFailures`. Los reintentos utilizan la
misma clave de salida. El bucket sigue siendo privado: las claves devueltas no
son enlaces publicos de descarga.

Las funciones estan conectadas mediante la ruta `POST /upload` de API Gateway
(integracion proxy con payload 2.0) y un event source mapping de SQS a crop.
El mapping recibe hasta cinco mensajes y activa `ReportBatchItemFailures`.
La visibilidad de 360 segundos equivale a seis veces el timeout de crop;
no se configura una ventana adicional de acumulacion de mensajes.

El stage `$default` registra solicitudes en CloudWatch en formato JSON,
incluyendo identificador, metodo, ruta, estado y error de integracion. No se
registra el contenido de las imagenes. El grupo conserva los logs por 14 dias.
El usuario que despliega necesita permisos para configurar la entrega de logs.

Las pruebas locales simulan S3 y no sustituyen una prueba desplegada en AWS.

### Probar el flujo despues de desplegar

En PowerShell, desde `iac/`, obtener el endpoint y enviar una imagen local:

```powershell
$uploadUrl = terraform output -raw upload_url
curl.exe -X POST "$uploadUrl" -F "image=@C:/ruta/foto.png"
```

La respuesta esperada es HTTP 202 con `uploadKey` y `processedKey`.
El resultado no aparece inmediatamente porque el procesamiento es asincrono.
Para comprobarlo, consultar la clave devuelta usando el perfil SSO propio:

```powershell
$bucketName = terraform output -raw images_bucket_name
aws s3api head-object --bucket $bucketName --key "processed/ID_circular.png" --profile TU_PERFIL
aws s3 cp "s3://$bucketName/processed/ID_circular.png" ./resultado.png --profile TU_PERFIL
```

Reemplazar `ID_circular.png` por la clave exacta devuelta en `processedKey`.
Si el resultado aun no existe, esperar unos segundos y consultar nuevamente.
Para diagnosticar un fallo, revisar los logs de API Gateway, upload y crop,
y comprobar si existen mensajes en la DLQ. El rol del usuario SSO tambien
necesita permisos de lectura para descargar el resultado.

### Red y salida a Internet

La VPC utiliza dos zonas de disponibilidad. Cada subred privada tiene su propia
tabla de rutas y una ruta `0.0.0.0/0` hacia el NAT Gateway de la misma zona.
Los dos NAT Gateways se encuentran en las subredes públicas, cada uno con una
Elastic IP. Las subredes públicas comparten una tabla de rutas hacia el Internet
Gateway conectado a la VPC.

El endpoint Gateway de S3 está asociado a ambas tablas privadas y el endpoint
Interface de SQS tiene una interfaz en cada subred privada. Las llamadas a estos
servicios utilizan los endpoints; el NAT proporciona salida para otros destinos.

Los NAT Gateways y las Elastic IP generan cargos mientras estén desplegados.
La configuración de red está en `iac/nat.tf` y `iac/vpc_endpoints.tf`.

## Fuentes de información
- **S3**
1. [Documentación de S3 con Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket)
- **SQS**
1. [Documentación de SQS con Terraform](https://daringfireball.net/projects/markdown/)
2. [Políticas en SQS](https://registry.terraform.io/providers/hashicorp/aws/2.34.0/docs/resources/sqs_queue_policy)
3. [Configuración de colas SQS usando Terraform](https://dev.to/aws-builders/configuring-amazon-sqs-queues-using-terraform-9g2)

- **API GATEAY**
1. [Documentación API GATEWAY en Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/apigatewayv2_api)
2. [CORS (Cross-Origin Resource Sharing)](https://registry.terraform.io/modules/lee0210/apigateway-cors/aws/latest)
