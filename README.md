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
- Terraform instalado
- Cuenta de AWS

### Manejo de entornos

| Entorno | Workspace | CIDR de la VPC |
|---|---|---|
| DEV | `dev` | `10.0.0.0/16` |
| QA | `qa` | `10.1.0.0/16` |
| PROD | `prod` | `10.2.0.0/16` |

## Configuración de Terraform

Los archivos Terraform se encuentran en el directorio `iac/`. Inicializa Terraform y selecciona o crea el workspace que usarás:

```bash
cd iac
terraform init
terraform workspace select dev
```

Si el workspace todavía no existe, créalo con `terraform workspace new dev`. Repite el proceso usando `qa` o `prod` para los otros entornos.

### Configuración de proveedores

Se configurará mediante **profile**.

#### AWS

El proveedor AWS usa una región y un perfil local de AWS CLI. La configuración del proyecto está en [`iac/providers.tf`](iac/providers.tf):

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region  = "region"
  profile = "customprofile"
}
```
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

### Amazon CloudWatch

La configuración está en [`iac/cloudwatch.tf`](iac/cloudwatch.tf). Se define una alarma sobre la métrica `ApproximateNumberOfMessagesVisible` de la cola de mensajes fallidos (DLQ).

- La alarma evalua la metrica cada 60s.
- Cuando se detecta mensajes visibles en la DLQ, envía una acción al tópico SNS configurado para las notificaciones.

### Amazon SNS

La configuración está en [`iac/sns.tf`](iac/sns.tf). Se crea un tópico para recibir las acciones de la alarma de CloudWatch y una suscripción por correo electrónico.

- El endpoint de correo es el correo de uno de nosotros, pero se podría usar el correo de cualquier persona, mientras sea una dirección válida.
- SNS envía un mensaje de confirmación al crear la suscripción. La persona debe confirmarla para empezar a recibir notificaciones.


## Fuentes de información
- **S3**
1. [Documentación de S3 con Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket)
- **SQS**
1. [Documentación de SQS con Terraform](https://daringfireball.net/projects/markdown/)
2. [Políticas en SQS](https://registry.terraform.io/providers/hashicorp/aws/2.34.0/docs/resources/sqs_queue_policy)
3. [Configuración de colas SQS usando Terraform](https://dev.to/aws-builders/configuring-amazon-sqs-queues-using-terraform-9g2)
- **Cloudwatch**
1. [Documentación de cludwatch](https://registry.terraform.io/modules/terraform-aws-modules/cloudwatch/aws/latest)
2. [Alarmas n de cludwatch](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm)
- **SNS**
1. [Tópicos SNS con Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sns_topic)
2. [Suscripciones SNS con Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sns_topic_subscription)
- **API GATEAY**
1. [Documentación API GATEWAY en Terraform](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/apigatewayv2_api)
2. [CORS (Cross-Origin Resource Sharing)](https://registry.terraform.io/modules/lee0210/apigateway-cors/aws/latest)
