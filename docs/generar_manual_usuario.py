# -*- coding: utf-8 -*-
"""Genera el Manual de Usuario del sistema de JISSACRUZ en PDF."""
import os 
from reportlab .lib import colors 
from reportlab .lib .pagesizes import A4 
from reportlab .lib .styles import ParagraphStyle ,getSampleStyleSheet 
from reportlab .lib .units import mm 
from reportlab .lib .enums import TA_CENTER ,TA_JUSTIFY 
from reportlab .platypus import (
BaseDocTemplate ,Frame ,PageTemplate ,Paragraph ,Spacer ,Table ,TableStyle ,
PageBreak ,Image ,KeepTogether ,ListFlowable ,ListItem ,
)

RAIZ =r"C:\Users\LENOVO\Documents\P-INVENTARIO-REPUESTOS\SISREP\JISSACRUZ\jissacruz-prueba"
SALIDA =os .path .join (RAIZ ,"docs","Manual_de_Usuario_JISSACRUZ.pdf")
LOGO =os .path .join (RAIZ ,"public","logo-empresa.png")

AZUL =colors .HexColor ("#0E3C6D")
AZUL2 =colors .HexColor ("#1D6DB2")
GRIS =colors .HexColor ("#B6B7B4")
GRIS_CLARO =colors .HexColor ("#F1F4F8")
TEXTO =colors .HexColor ("#212121")

ss =getSampleStyleSheet ()

S ={
"titulo_portada":ParagraphStyle ("tp",fontName ="Helvetica-Bold",fontSize =30 ,
leading =34 ,textColor =AZUL ,alignment =TA_CENTER ),
"sub_portada":ParagraphStyle ("sp",fontName ="Helvetica",fontSize =14 ,leading =20 ,
textColor =AZUL2 ,alignment =TA_CENTER ),
"pie_portada":ParagraphStyle ("pp",fontName ="Helvetica",fontSize =9.5 ,leading =14 ,
textColor =colors .HexColor ("#5A6570"),alignment =TA_CENTER ),
"h1":ParagraphStyle ("h1",fontName ="Helvetica-Bold",fontSize =18 ,leading =22 ,
textColor =colors .white ,spaceBefore =0 ,spaceAfter =0 ),
"h2":ParagraphStyle ("h2",fontName ="Helvetica-Bold",fontSize =13 ,leading =16 ,
textColor =AZUL ,spaceBefore =14 ,spaceAfter =5 ),
"h3":ParagraphStyle ("h3",fontName ="Helvetica-Bold",fontSize =10.8 ,leading =14 ,
textColor =AZUL2 ,spaceBefore =10 ,spaceAfter =3 ),
"p":ParagraphStyle ("p",fontName ="Helvetica",fontSize =9.7 ,leading =14.2 ,
textColor =TEXTO ,alignment =TA_JUSTIFY ,spaceAfter =6 ),
"li":ParagraphStyle ("li",fontName ="Helvetica",fontSize =9.7 ,leading =13.6 ,
textColor =TEXTO ,spaceAfter =2.5 ),
"celda":ParagraphStyle ("celda",fontName ="Helvetica",fontSize =8.6 ,leading =11.4 ,
textColor =TEXTO ),
"celda_b":ParagraphStyle ("celdab",fontName ="Helvetica-Bold",fontSize =8.6 ,leading =11.4 ,
textColor =TEXTO ),
"th":ParagraphStyle ("th",fontName ="Helvetica-Bold",fontSize =8.6 ,leading =11.4 ,
textColor =colors .white ),
"nota":ParagraphStyle ("nota",fontName ="Helvetica",fontSize =9.1 ,leading =13 ,
textColor =colors .HexColor ("#3A3A3A")),
"toc":ParagraphStyle ("toc",fontName ="Helvetica",fontSize =10 ,leading =17 ,
textColor =TEXTO ),
"toc_b":ParagraphStyle ("tocb",fontName ="Helvetica-Bold",fontSize =10 ,leading =17 ,
textColor =AZUL ),
}


# ---------------------------------------------------------------- utilidades
def P (t ,st ="p"):
    return Paragraph (t ,S [st ])


def UL (items ,bullet ="\u2022"):
    return ListFlowable (
    [ListItem (Paragraph (i ,S ["li"]),leftIndent =12 )for i in items ],
    bulletType ="bullet",start =bullet ,leftIndent =14 ,bulletFontSize =7 ,
    bulletOffsetY =-1 ,spaceBefore =2 ,spaceAfter =6 ,
    )


def OL (items ):
    return ListFlowable (
    [ListItem (Paragraph (i ,S ["li"]),leftIndent =14 )for i in items ],
    bulletType ="1",leftIndent =18 ,bulletFontName ="Helvetica-Bold",
    bulletFontSize =9.5 ,spaceBefore =2 ,spaceAfter =6 ,
    )


def H1 (texto ,numero =None ):
    """Titulo de capítulo: barra azul a todo el ancho."""
    etiqueta =f"{numero }.  {texto }"if numero else texto 
    t =Table ([[Paragraph (etiqueta ,S ["h1"])]],colWidths =[168 *mm ],rowHeights =[13 *mm ])
    t .setStyle (TableStyle ([
    ("BACKGROUND",(0 ,0 ),(-1 ,-1 ),AZUL ),
    ("LEFTPADDING",(0 ,0 ),(-1 ,-1 ),8 ),
    ("VALIGN",(0 ,0 ),(-1 ,-1 ),"MIDDLE"),
    ]))
    return [t ,Spacer (1 ,7 *mm )]


def TABLA (cabecera ,filas ,anchos ,negrita_col0 =False ):
    data =[[Paragraph (c ,S ["th"])for c in cabecera ]]
    for f in filas :
        fila =[]
        for i ,c in enumerate (f ):
            estilo ="celda_b"if (negrita_col0 and i ==0 )else "celda"
            fila .append (Paragraph (str (c ),S [estilo ]))
        data .append (fila )
    t =Table (data ,colWidths =anchos ,repeatRows =1 ,hAlign ="LEFT")
    t .setStyle (TableStyle ([
    ("BACKGROUND",(0 ,0 ),(-1 ,0 ),AZUL2 ),
    ("ROWBACKGROUNDS",(0 ,1 ),(-1 ,-1 ),[colors .white ,GRIS_CLARO ]),
    ("GRID",(0 ,0 ),(-1 ,-1 ),0.4 ,GRIS ),
    ("VALIGN",(0 ,0 ),(-1 ,-1 ),"TOP"),
    ("TOPPADDING",(0 ,0 ),(-1 ,-1 ),4 ),
    ("BOTTOMPADDING",(0 ,0 ),(-1 ,-1 ),4 ),
    ("LEFTPADDING",(0 ,0 ),(-1 ,-1 ),5 ),
    ("RIGHTPADDING",(0 ,0 ),(-1 ,-1 ),5 ),
    ]))
    return t 


def NOTA (texto ,titulo ="Importante",color =None ):
    color =color or AZUL2 
    cuerpo =[Paragraph (f"<b>{titulo }.</b> {texto }",S ["nota"])]
    t =Table ([[cuerpo ]],colWidths =[168 *mm ],hAlign ="LEFT")
    t .setStyle (TableStyle ([
    ("BACKGROUND",(0 ,0 ),(-1 ,-1 ),GRIS_CLARO ),
    ("LINEBEFORE",(0 ,0 ),(0 ,-1 ),2.6 ,color ),
    ("TOPPADDING",(0 ,0 ),(-1 ,-1 ),7 ),
    ("BOTTOMPADDING",(0 ,0 ),(-1 ,-1 ),7 ),
    ("LEFTPADDING",(0 ,0 ),(-1 ,-1 ),9 ),
    ("RIGHTPADDING",(0 ,0 ),(-1 ,-1 ),9 ),
    ]))
    return [Spacer (1 ,2 *mm ),t ,Spacer (1 ,4 *mm )]


    # ---------------------------------------------------------------- documento
class Manual (BaseDocTemplate ):
    def __init__ (self ,filename ,**kw ):
        BaseDocTemplate .__init__ (self ,filename ,pagesize =A4 ,
        leftMargin =21 *mm ,rightMargin =21 *mm ,
        topMargin =20 *mm ,bottomMargin =18 *mm ,
        title ="Manual de Usuario - Sistema de Inventario, Compras y Ventas - JISSACRUZ",
        author ="Dynamic Coding",**kw )
        marco =Frame (self .leftMargin ,self .bottomMargin ,self .width ,self .height ,id ="normal")
        self .addPageTemplates ([
        PageTemplate (id ="portada",frames =[marco ]),
        PageTemplate (id ="cuerpo",frames =[marco ],onPage =self .decorar ),
        ])

    def decorar (self ,canv ,doc ):
        canv .saveState ()
        # cabecera
        canv .setStrokeColor (GRIS )
        canv .setLineWidth (0.5 )
        canv .line (21 *mm ,A4 [1 ]-15 *mm ,A4 [0 ]-21 *mm ,A4 [1 ]-15 *mm )
        canv .setFont ("Helvetica",7.6 )
        canv .setFillColor (colors .HexColor ("#6B7480"))
        canv .drawString (21 *mm ,A4 [1 ]-13.2 *mm ,"Manual de Usuario  -  Sistema de Inventario, Compras y Ventas")
        canv .drawRightString (A4 [0 ]-21 *mm ,A4 [1 ]-13.2 *mm ,"JISSACRUZ  -  Santa Cruz, Bolivia")
        # pie
        canv .line (21 *mm ,13 *mm ,A4 [0 ]-21 *mm ,13 *mm )
        canv .setFont ("Helvetica",7.6 )
        canv .drawString (21 *mm ,9.4 *mm ,"Versión 1.0")
        canv .drawRightString (A4 [0 ]-21 *mm ,9.4 *mm ,"Página %d"%canv .getPageNumber ())
        canv .restoreState ()


        # ---------------------------------------------------------------- contenido
E =[]# story

# ---------- PORTADA ----------
E .append (Spacer (1 ,26 *mm ))
if os .path .exists (LOGO ):
    img =Image (LOGO ,width =62 *mm ,height =62 *mm ,kind ="proportional")
    img .hAlign ="CENTER"
    E .append (img )
    E .append (Spacer (1 ,12 *mm ))
E .append (P ("MANUAL DE USUARIO","titulo_portada"))
E .append (Spacer (1 ,4 *mm ))
E .append (Spacer (1 ,5 *mm ))
E .append (P ("Sistema de Inventario, Compras y Ventas de Repuestos","sub_portada"))
E .append (Spacer (1 ,16 *mm ))
tabla_portada =Table (
[[Paragraph ("<b>Cliente</b>",S ["celda"]),Paragraph ("JISSACRUZ - Santa Cruz de la Sierra, Bolivia",S ["celda"])],
[Paragraph ("<b>Desarrollo</b>",S ["celda"]),Paragraph ("Dynamic Coding",S ["celda"])],
[Paragraph ("<b>Versión del manual</b>",S ["celda"]),Paragraph ("1.0",S ["celda"])],
[Paragraph ("<b>Alcance</b>",S ["celda"]),Paragraph ("Sprints 1 a 5 - catálogo, inventario multi-sucursal, compras, traspasos, proformas, ventas (POS), reportes y configuración",S ["celda"])],
[Paragraph ("<b>Uso previsto</b>",S ["celda"]),Paragraph ("Capacitación de usuarios y pruebas de funcionamiento (UAT)",S ["celda"])]],
colWidths =[38 *mm ,110 *mm ],hAlign ="CENTER")
tabla_portada .setStyle (TableStyle ([
("GRID",(0 ,0 ),(-1 ,-1 ),0.4 ,GRIS ),
("BACKGROUND",(0 ,0 ),(0 ,-1 ),GRIS_CLARO ),
("VALIGN",(0 ,0 ),(-1 ,-1 ),"TOP"),
("TOPPADDING",(0 ,0 ),(-1 ,-1 ),5 ),
("BOTTOMPADDING",(0 ,0 ),(-1 ,-1 ),5 ),
]))
E .append (tabla_portada )
E .append (Spacer (1 ,18 *mm ))
E .append (P ("Documento de uso interno. Todos los importes del sistema están expresados en Bolivianos (Bs).","pie_portada"))
E .append (PageBreak ())

# a partir de aqui, plantilla con cabecera y pie
from reportlab .platypus import NextPageTemplate 
E .insert (len (E )-1 ,NextPageTemplate ("cuerpo"))

# ---------- INDICE ----------
E +=H1 ("Contenido")
indice =[
("1","Introducción","Qué es el sistema y qué resuelve"),
("2","Primeros pasos","Acceso, pantalla principal, navegación y cierre de sesión"),
("3","Roles y permisos","Qué puede hacer un administrador y qué un vendedor"),
("4","Conceptos clave","Kardex, FIFO, stock por sucursal, numeración, descuentos"),
("5","Dashboard","Indicadores del día y accesos rápidos"),
("6","Productos","Catálogo, búsqueda avanzada, equivalentes, vehículos y precios por mayor"),
("7","Inventario","Stock por sucursal, semáforo y ajustes manuales"),
("8","Kardex","Historial de movimientos y exportación"),
("9","Traspasos entre sucursales","Pedido, despacho, recepción y cancelación"),
("10","Proveedores","Registro de proveedores"),
("11","Compras","Órdenes de compra y recepción de mercadería"),
("12","Clientes","Ficha, datos de factura e historial"),
("13","Proformas","Cotización, PDF y conversión a venta"),
("14","Ventas (POS)","Punto de venta, comprobante e historial"),
("15","Reportes","Los cuatro reportes y su exportación"),
("16","Sucursales","Alta y mantenimiento de sucursales"),
("17","Configuración","Datos de empresa, stock mínimo y usuarios"),
("18","Plan de pruebas de funcionamiento","Guión paso a paso para la UAT"),
("19","Mensajes y errores frecuentes","Qué significan y cómo resolverlos"),
("20","Anexo técnico","Entorno, scripts de base de datos y puesta en marcha"),
]
filas_idx =[[n ,f"<b>{t }</b>",d ]for n ,t ,d in indice ]
E .append (TABLA (["N.","Capítulo","Contenido"],filas_idx ,[12 *mm ,52 *mm ,104 *mm ]))
E .append (PageBreak ())

# ---------- 1. INTRODUCCION ----------
E +=H1 ("Introducción",1 )
E .append (P ("Este es el sistema web de <b>inventario, compras y ventas de repuestos para camiones de alto tonelaje</b>, desarrollado a medida para la tienda de JISSACRUZ. Reemplaza el control manual de stock y la emisión de cotizaciones en planillas por un único sistema donde cada movimiento de mercadería queda registrado, trazable y valorizado."))
E .append (P ("El sistema se usa desde el navegador (Google Chrome, Microsoft Edge o Firefox actualizados), no requiere instalación en la computadora y puede usarse en varias máquinas al mismo tiempo. Toda la información vive en un único servidor, de modo que lo que registra un usuario lo ven de inmediato los demás."))

E .append (P ("Qué permite hacer el sistema","h2"))
E .append (UL ([
"Mantener el <b>catálogo de repuestos</b> con códigos propios, códigos equivalentes de otros fabricantes, vehículos compatibles, precio y precios por mayor.",
"Consultar el <b>stock por sucursal</b> con un semáforo de colores y alertas de stock mínimo.",
"Registrar <b>órdenes de compra</b> a proveedores y dar de alta la mercadería recibida, con actualización automática del stock.",
"Mover mercadería entre sucursales con <b>pedidos de traspaso</b> (despacho y recepción controlados).",
"Emitir <b>proformas</b> imprimibles en PDF y convertirlas en venta con un clic.",
"Vender desde un <b>punto de venta (POS)</b> que descuenta el stock automáticamente y emite el comprobante en PDF.",
"Consultar el <b>Kardex</b> de cada producto: cada entrada, cada salida y el saldo resultante.",
"Obtener <b>reportes</b> de ventas, proformas, productos más vendidos y estado del inventario, exportables a PDF y Excel.",
]))

E .append (P ("Qué NO hace el sistema","h2"))
E .append (P ("Es importante tenerlo claro antes de las pruebas, para no reportar como falla algo que está fuera del alcance acordado:"))
E .append (UL ([
"No emite factura fiscal ni se conecta con el SIN: el comprobante de venta es un documento interno.",
"No lleva cuentas por cobrar, caja ni contabilidad; registra la venta, no el cobro en cuotas.",
"No tiene registro público de usuarios: las cuentas las crea el administrador desde Configuración.",
"No maneja un catálogo administrable de categorías: la <b>línea o marca</b> es un campo de texto del producto.",
]))
E .append (PageBreak ())

# ---------- 2. PRIMEROS PASOS ----------
E +=H1 ("Primeros pasos",2 )

E .append (P ("2.1  Ingresar al sistema","h2"))
E .append (OL ([
"Abrir el navegador e ingresar la dirección del sistema (en pruebas locales, <b>http://localhost:3000</b>).",
"El sistema muestra la pantalla de <b>inicio de sesión</b>, con dos campos: <b>Correo</b> y <b>Contraseña</b>.",
"Escribir las credenciales entregadas por el administrador y presionar <b>Ingresar</b>.",
"Si los datos son correctos, el sistema abre el <b>Dashboard</b> (administrador) o el módulo principal según el rol.",
]))
E +=NOTA ("Si aparece el mensaje <i>Credenciales inválidas</i>, revisar que el correo esté bien escrito y que no haya quedado activada la tecla Bloq Mayús. Si el administrador desactivó la cuenta, el sistema cierra la sesión y vuelve a la pantalla de ingreso aunque la contraseña sea correcta.")

E .append (P ("2.2  Partes de la pantalla","h2"))
E .append (TABLA (
["Zona","Dónde está","Para qué sirve"],
[["Menú lateral","Franja izquierda","Navegación entre módulos, agrupada en cinco secciones: Principal, Inventario, Compras, Ventas y Administración. Aparece angosto (solo iconos) y se despliega al pasar el cursor; el botón <b>Fijar menú</b> lo deja abierto de forma permanente."],
["Barra superior","Arriba a la derecha","Muestra el nombre de la sección actual, la <b>sucursal asignada</b> al usuario y el menú de la cuenta."],
["Menú de la cuenta","Avatar con iniciales","Muestra nombre, rol y sucursal; contiene la opción <b>Cerrar sesión</b>."],
["Área de trabajo","Centro de la pantalla","Tablas, formularios y filtros del módulo abierto."],
["Avisos emergentes","Esquina de la pantalla","Confirmaciones en verde y errores en rojo después de cada acción."]],
[30 *mm ,33 *mm ,105 *mm ],negrita_col0 =True ))

E .append (P ("2.3  Cómo se trabaja en el sistema","h2"))
E .append (P ("Todos los módulos siguen el mismo patrón, de modo que aprendido uno se entienden los demás:"))
E .append (UL ([
"Una <b>tabla</b> lista los registros existentes, con un buscador y filtros arriba.",
"El botón azul de la derecha (<b>Nuevo...</b>) abre un panel lateral o una ventana para cargar un registro.",
"Los iconos al final de cada fila son las acciones sobre ese registro: lápiz para editar, ojo para ver, tacho para eliminar, reloj para historial, etc.",
"Las acciones que no se pueden deshacer (recibir mercadería, convertir una proforma, eliminar) siempre piden una <b>confirmación</b> previa.",
]))

E .append (P ("2.4  Cerrar sesión","h2"))
E .append (P ("Hacer clic en el avatar con las iniciales, arriba a la derecha, y elegir <b>Cerrar sesión</b>. Es obligatorio hacerlo al terminar el turno en computadoras compartidas: mientras la sesión siga abierta, cualquiera puede registrar operaciones a nombre del usuario."))
E .append (PageBreak ())

# ---------- 3. ROLES ----------
E +=H1 ("Roles y permisos",3 )
E .append (P ("El sistema tiene dos roles. El rol se define al crear el usuario y determina que opciones aparecen en el menú y que acciones están habilitadas."))
E .append (UL ([
"<b>Administrador:</b> acceso total. Además de vender, administra el catálogo, las compras, las sucursales, los reportes y los usuarios.",
"<b>Vendedor:</b> perfil comercial. Consulta el catálogo y el inventario, atiende clientes, emite proformas y registra ventas, pero no modifica productos ni precios ni ve reportes.",
]))

E .append (P ("3.1  Matriz de permisos","h2"))
E .append (TABLA (
["Módulo","Administrador","Vendedor"],
[["Dashboard","Sí","No (no aparece en el menú)"],
["Productos","Alta, edición y eliminación","Solo consulta (abre la ficha en modo lectura)"],
["Inventario","Consulta y <b>ajuste manual de stock</b>","Solo consulta"],
["Kardex","Consulta y exportación","Consulta y exportación"],
["Traspasos","Crea, despacha, recibe y cancela en cualquier sucursal","Solo sobre pedidos de su sucursal (despacha los que salen, recibe los que llegan)"],
["Proveedores","Alta y edición","Sin acceso"],
["Compras","Órdenes y recepción de mercadería","Sin acceso"],
["Clientes","Alta, edición, historial y eliminación","Alta, edición e historial (no puede eliminar)"],
["Proformas","Todo","Todo"],
["Ventas (POS)","Todo","Todo"],
["Reportes","Sí","Sin acceso"],
["Sucursales","Sí","Sin acceso"],
["Configuración","Sí","Sin acceso"]],
[38 *mm ,60 *mm ,70 *mm ],negrita_col0 =True ))
E +=NOTA ("El menú lateral oculta automáticamente los módulos que el rol no puede usar, e incluso las secciones completas que quedan vacías. Si un vendedor escribe la dirección de una pantalla de administrador, el sistema lo devuelve al inicio.","Cómo se aplica")
E .append (PageBreak ())

# ---------- 4. CONCEPTOS ----------
E +=H1 ("Conceptos clave",4 )
E .append (P ("Estas cinco ideas explican por qué el sistema se comporta como se comporta. Conviene leerlas antes de probar, porque evitan la mayoría de las dudas durante la UAT."))

E .append (P ("4.1  El Kardex es la fuente de verdad del stock","h2"))
E .append (P ("El stock no se escribe a mano en ningun lado. Cada unidad que entra o sale genera un <b>movimiento de Kardex</b>, y el stock que se ve en pantalla es el resultado de esos movimientos. Por eso solo hay cuatro maneras de que el stock cambie:"))
E .append (UL ([
"<b>Recepción de una orden de compra</b> (entrada).",
"<b>Registro de una venta</b>, sea desde el POS o por conversión de una proforma (salida).",
"<b>Ajuste manual</b> desde Inventario, con motivo obligatorio (entrada o salida).",
"<b>Traspaso entre sucursales</b>: salida en la sucursal de origen al despachar, entrada en la de destino al recibir.",
]))
E +=NOTA ("Consecuencia práctica para las pruebas: si el stock de un producto no coincide con lo esperado, la explicación siempre está en su Kardex. Abrir el Kardex del producto y revisar la columna Saldo movimiento por movimiento.","Para recordar")

E .append (P ("4.2  Valorización FIFO por lotes","h2"))
E .append (P ("Cada entrada crea un <b>lote</b> con su costo. Cuando se vende o se despacha un traspaso, el sistema consume primero los lotes más antiguos (método FIFO, <i>primero en entrar, primero en salir</i>). Así el costo que aparece en el Kardex y en la valorización del inventario refleja lo que realmente se pago por esa mercadería. El usuario no hace nada especial: el cálculo es automático."))

E .append (P ("4.3  Stock por sucursal","h2"))
E .append (P ("El stock no es un único número por producto: es un número <b>por producto y por sucursal</b>. En las listas de Productos e Inventario, cada fila muestra el semáforo con el total y, al lado, una insignia por sucursal:"))
E .append (TABLA (
["Se ve así","Significa"],
[["Disponible (24) en verde","Total en todas las sucursales por encima del stock mínimo"],
["Stock bajo (3) en amarillo","Total igual o menor al stock mínimo del producto: hay que reponer"],
["Sin stock (0) en rojo","No queda ninguna unidad en ninguna sucursal"],
["1: 18","En la sucursal de código 1 hay 18 unidades"],
["2: BO","En la sucursal de código 2 no hay unidades (BO = <i>back order</i>, pendiente)"]],
[46 *mm ,122 *mm ],negrita_col0 =True ))
E .append (P ("Las operaciones (venta, ajuste, compra) impactan la sucursal asignada al usuario que las realiza; por eso es fundamental que cada usuario tenga su sucursal correctamente configurada.","p"))

E .append (P ("4.4  Numeración automática de documentos","h2"))
E .append (P ("Los números de documento los genera el sistema y son correlativos: <b>PRO-0001</b> para proformas, <b>VEN-0001</b> para ventas y <b>TRA-0001</b> para pedidos de traspaso. No se pueden editar, no se repiten y no se saltan por error del usuario."))

E .append (P ("4.5  Descuentos, impuesto y precios por mayor","h2"))
E .append (UL ([
"El descuento se puede aplicar <b>por línea</b> (a un producto del detalle) y <b>global</b> (sobre el subtotal), en cada caso como <b>porcentaje (%)</b> o como <b>monto fijo (Bs)</b>.",
"El <b>impuesto</b> es un porcentaje manual que por defecto viene en 0: el sistema no agrega IVA automáticamente.",
"Los <b>precios por mayor</b> se cargan por producto como escalas (por ejemplo, desde 20 unidades, desde 100 unidades) y pueden tener fecha de vigencia. Al cargar la cantidad en una proforma o en el POS, el precio unitario se ajusta solo a la escala vigente que corresponda; igualmente el precio queda editable a mano.",
"El orden de cálculo es: subtotal de líneas (ya con su descuento) menos descuento global, y sobre ese resultado se aplica el impuesto.",
]))
E .append (PageBreak ())

# ---------- 5. DASHBOARD ----------
E +=H1 ("Dashboard",5 )
E .append (P ("<i>Menú: Principal &gt; Dashboard. Solo administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Es la pantalla de apertura del administrador y resume el estado del negocio en el momento. Se compone de:"))
E .append (TABLA (
["Elemento","Qué muestra"],
[["Ventas de hoy","Suma en Bs de todas las ventas registradas en el día en curso."],
["Stock bajo","Cantidad de productos cuyo stock está en o por debajo de su mínimo. Se pinta en tono de alerta cuando es mayor que cero."],
["Proformas pendientes","Proformas vigentes que todavía no se convirtieron en venta ni vencieron."],
["Compras recientes","Cantidad de órdenes de compra en el listado de las últimas cinco."],
["Gráfico de 7 días","Ventas totales por día de la última semana."],
["Productos con stock crítico","Los ocho productos más urgentes de reponer, ordenados del más crítico al menos crítico, con enlace a Inventario."],
["Compras recientes (detalle)","Últimas cinco órdenes con proveedor, fecha y estado."]],
[42 *mm ,126 *mm ],negrita_col0 =True ))
E .append (P ("Arriba a la derecha hay tres accesos directos: <b>Nueva venta</b>, <b>Nueva proforma</b> y <b>Nuevo producto</b>."))
E +=NOTA ("Los indicadores se calculan al abrir la pantalla. Después de registrar una venta, volver a entrar al Dashboard (o recargar) para verlos actualizados.","Al probar")
E .append (PageBreak ())

# ---------- 6. PRODUCTOS ----------
E +=H1 ("Productos",6 )
E .append (P ("<i>Menú: Inventario &gt; Productos. Administrador: alta, edición y baja. Vendedor: solo consulta.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Es el catálogo de repuestos. Cada fila muestra la imagen, el código, la descripción, la línea o marca, el precio y el stock con su desglose por sucursal."))

E .append (P ("6.1  Buscar un producto","h2"))
E .append (P ("La búsqueda es la función más usada del sistema y trabaja en dos partes:"))
E .append (OL ([
"<b>Elegir los criterios.</b> Arriba de la tabla, la fila <b>Buscar por:</b> tiene casillas para <b>Código</b>, <b>Equivalente</b>, <b>Descripción</b>, <b>Línea / Marca</b> y <b>Vehículo</b>. Por defecto viene marcado solo <b>Código</b>. Se pueden marcar varias a la vez: el sistema trae lo que coincida en cualquiera de ellas. Si no se marca ninguna, busca en todas.",
"<b>Escribir el texto.</b> A medida que se escribe, la tabla se actualiza sola (no hay botón Buscar).",
]))
E .append (P ("<b>Búsqueda por fragmentos.</b> No hace falta escribir palabras completas ni en orden exacto. Al escribir <b>piston comp 85</b> el sistema exige que el campo contenga los tres fragmentos, en cualquier posición; también se acepta el comodín <b>%</b> al estilo del sistema anterior del cliente, por ejemplo <b>Piston%comp%85</b>."))
E +=NOTA ("Ejemplo real de prueba: marcar el criterio <b>Equivalente</b> y buscar un código OEM (por ejemplo 9730025210). El sistema debe devolver el repuesto TKL correspondiente aunque ese número no sea el código propio del producto. Esta es la función que reemplaza la búsqueda en los catálogos impresos.","Caso de prueba sugerido")

E .append (P ("6.2  Crear o editar un producto","h2"))
E .append (P ("Con el botón <b>Nuevo producto</b> (o el lápiz de una fila) se abre un panel lateral con cuatro bloques:"))
E .append (P ("Datos generales","h3"))
E .append (TABLA (
["Campo","Obligatorio","Detalle"],
[["Código","Sí","Código propio de JISSACRUZ. No se puede repetir."],
["Línea / marca","No","Texto libre (por ejemplo TKL). Se usa para agrupar en el reporte de inventario."],
["Descripción","Sí","Nombre y aplicación del repuesto. Es el texto que se imprime en proformas y comprobantes."],
["Unidad","No","Unidad de medida; por defecto <i>unidad</i>."],
["Precio (Bs)","Sí","Precio de venta base. Se propone automáticamente al agregar el producto a una proforma o venta."],
["Stock mínimo","No","Umbral del semáforo: en o por debajo de este valor el producto aparece como <i>Stock bajo</i>."],
["Imagen","No","Se sube desde el equipo y se muestra una vista previa."]],
[30 *mm ,20 *mm ,118 *mm ],negrita_col0 =True ))

E .append (P ("Códigos equivalentes","h3"))
E .append (P ("Permite registrar los códigos con los que el mismo repuesto se conoce en otras marcas (OEM y fabricantes). Con <b>Agregar</b> se suma una línea con el código y, opcionalmente, el fabricante. Estos códigos son los que encuentra la búsqueda con el criterio <b>Equivalente</b>."))

E .append (P ("Vehículos compatibles","h3"))
E .append (P ("Marca, modelo y rango de años (desde / hasta) de los vehículos donde entra el repuesto. Alimenta la búsqueda con el criterio <b>Vehículo</b>."))

E .append (P ("Precios por mayor","h3"))
E .append (P ("Cada escala se carga con tres datos: <b>Desde (cantidad)</b>, <b>Precio (Bs)</b> y <b>Vigente hasta</b> (fecha opcional). La cantidad mínima debe ser 2 o más y no se puede repetir la misma cantidad dos veces en el mismo producto. Ejemplo: desde 20 unidades a Bs 95, desde 100 unidades a Bs 88 con vigencia hasta el 31/12."))
E .append (P ("Al terminar se presiona <b>Guardar</b>. Si algún dato obligatorio falta, el campo se marca en rojo con el motivo."))

E .append (P ("6.3  Eliminar un producto","h2"))
E .append (P ("El icono de tacho pide confirmación y da de baja el producto: deja de aparecer en el catálogo y en las búsquedas, <b>pero no se borra su historial de Kardex</b>, de modo que los reportes y los documentos ya emitidos siguen siendo consistentes."))
E .append (PageBreak ())

# ---------- 7. INVENTARIO ----------
E +=H1 ("Inventario",7 )
E .append (P ("<i>Menú: Inventario &gt; Inventario / Kardex. Vendedor: consulta. Administrador: además, ajuste de stock.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Muestra el catálogo desde la óptica de las existencias: código, descripción, línea o marca y el <b>stock por sucursal</b>. Tiene el mismo buscador por criterios que Productos, incluida la búsqueda por fragmentos."))

E .append (P ("7.1  Interpretar el semáforo","h2"))
E .append (P ("El color resume la situación del producto de un vistazo. Verde: hay existencias por encima del mínimo. Amarillo: el stock llegó al mínimo, hay que reponer. Rojo: no queda stock. Las insignias grises al lado (por ejemplo <b>1: 18</b>) indican cuánto hay en cada sucursal, y la insignia roja <b>BO</b> señala que en esa sucursal no queda ninguna unidad."))

E .append (P ("7.2  Ajuste manual de stock","h2"))
E .append (P ("Sirve para corregir diferencias reales: mercadería dañada, faltantes de inventario físico, sobrantes o carga del stock inicial. Solo el administrador lo ve (icono de controles deslizantes)."))
E .append (OL ([
"Buscar el producto y presionar el icono de <b>Ajustar stock</b> en su fila.",
"Elegir el <b>tipo de ajuste</b>: <b>Entrada</b> (suma) o <b>Salida</b> (resta).",
"Cargar la <b>cantidad</b>. En las entradas se puede indicar además el <b>costo unitario</b>, que será el costo del lote que se crea.",
"Escribir el <b>motivo</b>. Es obligatorio: es la justificación que quedará para siempre en el Kardex.",
"Presionar <b>Confirmar ajuste</b>.",
]))
E +=NOTA ("El ajuste impacta la sucursal del usuario que lo hace y queda asentado en el Kardex como <i>Ajuste de entrada</i> o <i>Ajuste de salida</i> con su motivo. No es un modo de 'editar' el stock sin dejar rastro: no existe tal modo, y es intencional.","Trazabilidad")
E .append (P ("Desde cada fila, el icono de cajas abre el <b>Kardex</b> de ese producto."))
E .append (PageBreak ())

# ---------- 8. KARDEX ----------
E +=H1 ("Kardex",8 )
E .append (P ("<i>Se abre desde Inventario, con el icono de cajas de cada producto.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Es el estado de cuenta del producto: la lista completa de sus movimientos, del más reciente al más antiguo. Arriba figuran el código, la descripción y el stock actual."))
E .append (TABLA (
["Columna","Qué informa"],
[["Fecha","Día y hora del movimiento."],
["Movimiento","Entrada por compra, Salida por venta, Ajuste de entrada o Ajuste de salida (los traspasos aparecen como sus entradas y salidas correspondientes)."],
["Cantidad","Unidades del movimiento."],
["Costo","Costo unitario del lote involucrado, en Bs."],
["Saldo","Existencias que quedaron después de ese movimiento."],
["Motivo","Justificación, cuando corresponde (obligatoria en los ajustes)."]],
[28 *mm ,140 *mm ],negrita_col0 =True ))
E .append (P ("Con los botones de la esquina superior derecha se puede <b>Exportar PDF</b> (documento con el membrete de la empresa) y <b>Exportar Excel</b> (planilla con las mismas columnas, útil para conciliar con inventarios físicos)."))
E +=NOTA ("Al hacer la UAT conviene tener el Kardex de un producto de prueba abierto en otra pestaña: cada compra, venta, ajuste o traspaso de ese producto debe aparecer allí con el saldo correcto.","Consejo para la prueba")
E .append (PageBreak ())

# ---------- 9. TRASPASOS ----------
E +=H1 ("Traspasos entre sucursales",9 )
E .append (P ("<i>Menú: Inventario &gt; Traspasos. Disponible para administrador y vendedor.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Permite mover mercadería de una sucursal a otra dejando constancia del movimiento. El traspaso se hace en <b>dos pasos</b> (despacho y recepción), de modo que mientras la mercadería está en camino se sabe que ya salió del origen pero todavía no llegó al destino."))

E .append (P ("9.1  Estados de un pedido","h2"))
E .append (TABLA (
["Estado","Significa","Acciones disponibles"],
[["PENDIENTE","El pedido está creado pero la mercadería no salió.","Despachar / Cancelar (desde el origen)"],
["ENVIADO","Se descontaron las unidades del origen; la mercadería está en tránsito.","Recibir (desde el destino)"],
["RECIBIDO","El destino confirmó la llegada y las unidades ya suman a su stock.","Ninguna (documento cerrado)"],
["CANCELADO","El pedido se anuló antes de despacharse. No afectó el stock.","Ninguna"]],
[26 *mm ,74 *mm ,68 *mm ],negrita_col0 =True ))

E .append (P ("9.2  Crear un pedido de traspaso","h2"))
E .append (OL ([
"Presionar <b>Solicitud de Traspaso</b>.",
"Verificar la <b>sucursal de origen</b>. El administrador puede elegir cualquiera; el vendedor tiene fija la suya.",
"Elegir la <b>sucursal de destino</b> (el sistema no permite que sea igual al origen).",
"Buscar cada producto por código o descripción, agregarlo y ajustar la <b>cantidad</b>.",
"Opcionalmente escribir <b>notas u observaciones</b> (por ejemplo, el motivo o la urgencia).",
"Presionar <b>Crear Pedido</b>. El sistema asigna el número TRA-0001 y el pedido queda en estado PENDIENTE.",
]))

E .append (P ("9.3  Despachar y recibir","h2"))
E .append (UL ([
"<b>Despachar:</b> en la fila del pedido pendiente, el usuario de la sucursal de origen presiona <b>Despachar</b>. El sistema descuenta las unidades del origen consumiendo los lotes más antiguos (FIFO), registra la salida en el Kardex y pasa el pedido a ENVIADO.",
"<b>Recibir:</b> el usuario de la sucursal de destino presiona <b>Recibir</b>. Las unidades ingresan como un lote nuevo con el mismo costo que tenían en el origen (un traspaso no genera ganancia ni pérdida) y el pedido pasa a RECIBIDO.",
"<b>Cancelar:</b> solo mientras el pedido está PENDIENTE. Una vez despachado ya no se puede cancelar, porque el stock se movió.",
]))
E .append (P ("Haciendo clic en la celda de <b>Ítems</b> se abre el detalle con los productos, las cantidades y, una vez despachado, el costo FIFO por unidad (visible para el administrador)."))
E +=NOTA ("Si al despachar aparece un error de stock insuficiente, es correcto: el origen no tiene esas unidades. Revisar el stock por sucursal antes de armar el pedido.","Comportamiento esperado")
E .append (PageBreak ())

# ---------- 10. PROVEEDORES ----------
E +=H1 ("Proveedores",10 )
E .append (P ("<i>Menú: Compras &gt; Proveedores. Solo administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Registro de las empresas a las que JISSACRUZ compra repuestos. Es un requisito previo para poder emitir órdenes de compra."))
E .append (TABLA (
["Campo","Obligatorio","Detalle"],
[["Nombre","Sí","Razón social o nombre comercial del proveedor."],
["Contacto","No","Persona de contacto y/o teléfono."],
["NIT","No","Identificación tributaria."],
["Dirección","No","Domicilio del proveedor."]],
[30 *mm ,22 *mm ,116 *mm ],negrita_col0 =True ))
E .append (P ("Con <b>Nuevo proveedor</b> se abre la ventana de carga; el lápiz de cada fila permite editarlo. El buscador filtra la lista por nombre."))
E .append (PageBreak ())

# ---------- 11. COMPRAS ----------
E +=H1 ("Compras",11 )
E .append (P ("<i>Menú: Compras &gt; Compras. Solo administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Gestiona las órdenes de compra a proveedores y, sobre todo, la <b>recepción de mercadería</b>, que es el momento en que el stock aumenta."))

E .append (P ("11.1  Crear una orden de compra","h2"))
E .append (OL ([
"Presionar <b>Nueva orden de compra</b>.",
"Elegir el <b>proveedor</b> de la lista.",
"Buscar los productos (con los mismos criterios de búsqueda del catálogo) y agregarlos uno por uno.",
"Para cada ítem, cargar la <b>cantidad</b> y el <b>costo unitario</b> en Bs que factura el proveedor.",
"Opcionalmente agregar <b>notas</b>.",
"Presionar <b>Crear orden</b>. La orden queda en estado <b>pendiente</b>.",
]))
E +=NOTA ("Crear la orden <b>no</b> modifica el stock. Es un documento de intención de compra: recien la recepción mueve el inventario.","Punto clave")

E .append (P ("11.2  Recibir la mercadería","h2"))
E .append (OL ([
"En la lista de órdenes, presionar el icono de <b>ojo</b> de la orden pendiente para ver su detalle (proveedor, fecha, ítems y total).",
"Presionar <b>Recibir mercadería</b> y confirmar en el cartel de aviso.",
"El sistema, en una sola operación: suma las unidades al stock de la sucursal de destino, crea el lote con su costo, registra las entradas en el Kardex y marca la orden como <b>recibida</b>.",
]))
E .append (P ("La recepción no se puede deshacer desde la interfaz. Si se recibió de más o de menos, la corrección se hace con un <b>ajuste manual</b> desde Inventario, indicando el motivo."))

E .append (P ("11.3  Consultar el historial de compras","h2"))
E .append (P ("La tabla lista todas las órdenes con fecha, proveedor, cantidad de ítems, total y estado (<i>pendiente</i>, <i>recibida</i> o <i>cancelada</i>). El selector de la izquierda filtra por proveedor, lo que responde a la pregunta <i>que le compramos a este proveedor</i>."))
E .append (PageBreak ())

# ---------- 12. CLIENTES ----------
E +=H1 ("Clientes",12 )
E .append (P ("<i>Menú: Ventas &gt; Clientes. Vendedor y administrador; la eliminación es solo del administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Registro de los clientes que reciben proformas y comprobantes de venta."))
E .append (TABLA (
["Campo","Para que se usa"],
[["Nombre","Nombre con el que se identifica al cliente en listas y documentos."],
["CI / NIT","Documento del cliente. <b>Es el código con el que se lo busca</b> en proformas y en el POS."],
["Complemento","Complemento del NIT cuando corresponde (por ejemplo A2). Se muestra junto al NIT."],
["Nombre de factura","Razón social a imprimir cuando difiere del nombre habitual."],
["Teléfono","Contacto; aparece en el recuadro del cliente en el PDF."],
["Dirección","Domicilio; aparece en el recuadro del cliente en el PDF."]],
[36 *mm ,132 *mm ],negrita_col0 =True ))
E .append (P ("El buscador de la parte superior filtra por <b>nombre, CI/NIT o teléfono</b>. En cada fila hay tres acciones: <b>historial</b> (reloj), <b>editar</b> (lápiz) y <b>eliminar</b> (tacho, solo administrador)."))

E .append (P ("12.1  Historial del cliente","h2"))
E .append (P ("El icono de reloj abre una ventana con todas las <b>proformas</b> y <b>ventas</b> de ese cliente, con sus números, fechas y totales. Sirve para responder rápido consultas del tipo <i>que le cotizamos la semana pasada</i>."))
E +=NOTA ("Un cliente que ya tiene proformas o ventas registradas no se puede eliminar: el sistema lo impide para no romper la trazabilidad de los documentos. Es el comportamiento esperado, no una falla.","Al probar la eliminación")
E .append (PageBreak ())

# ---------- 13. PROFORMAS ----------
E +=H1 ("Proformas",13 )
E .append (P ("<i>Menú: Ventas &gt; Proformas. Vendedor y administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("La proforma es la cotización que se entrega al cliente. <b>No mueve stock</b>: reserva un precio y unas condiciones por un plazo. Cuando el cliente acepta, se convierte en venta con un clic."))

E .append (P ("13.1  Emitir una proforma","h2"))
E .append (OL ([
"Presionar <b>Nueva proforma</b>.",
"<b>Cliente:</b> escribir el código/NIT o el nombre en el buscador y elegirlo de la lista. Al seleccionarlo se completan automáticamente su NIT (con complemento) y su nombre de factura. Si el cliente no existe, primero hay que darlo de alta en el módulo Clientes.",
"<b>Tipo de pago:</b> texto libre (por ejemplo Contado o Crédito). Se imprime en el recuadro del cliente del PDF.",
"<b>Validez (días):</b> por cuántos días se sostiene la cotización. Por defecto 15; define cuándo la proforma pasa a <i>vencida</i>.",
"<b>Entrega (días):</b> plazo de entrega comprometido. Si se deja en 0, la leyenda no se imprime.",
"<b>Agregar productos:</b> elegir los criterios de búsqueda, escribir el texto y hacer clic en cada producto del resultado. El precio se toma del catálogo.",
"Para cada línea, ajustar la <b>cantidad</b>, el <b>precio</b> si corresponde y el <b>descuento</b> de esa línea (% o Bs). Si el producto tiene precios por mayor, al cambiar la cantidad el precio se ajusta solo a la escala vigente.",
"Definir, si corresponde, el <b>descuento global</b> y el <b>impuesto %</b>. El recuadro de totales se recalcula en el momento.",
"Escribir la <b>glosa</b> si se quiere una aclaración impresa arriba del detalle.",
"Presionar <b>Crear proforma</b>. El sistema asigna el número (PRO-0001) y avisa en pantalla.",
]))

E .append (P ("13.2  Estados de la proforma","h2"))
E .append (TABLA (
["Estado","Cuándo ocurre"],
[["Vigente","Recien emitida y dentro de su plazo de validez. Es la única que se puede convertir en venta."],
["Convertida","Ya se transformo en venta; el stock se descontó en ese momento."],
["Vencida","Pasó el plazo de validez sin convertirse. El sistema lo calcula solo, por fecha."]],
[30 *mm ,138 *mm ],negrita_col0 =True ))

E .append (P ("13.3  Buscar, imprimir y convertir","h2"))
E .append (UL ([
"<b>Filtros:</b> por cliente, por estado y por rango de fechas (Desde / Hasta), con botón <b>Limpiar</b>.",
"<b>PDF:</b> el icono de descarga abre la proforma imprimible, con el encabezado de la empresa, el logo, la sucursal, el vendedor, el detalle de ítems, el total en números y en letras, la validez y el tiempo de entrega.",
"<b>Convertir a venta:</b> el icono de dos flechas. Pide confirmación y, al aceptar, registra la venta con los mismos ítems y descuentos, <b>descuenta el stock</b> y deja la proforma como <i>convertida</i>. El aviso ofrece un enlace para ver el comprobante.",
]))
E +=NOTA ("La conversión no se puede deshacer y una proforma solo se convierte una vez. Si el cliente cambia el pedido, corresponde emitir una proforma nueva.","Acción irreversible")
E .append (PageBreak ())

# ---------- 14. VENTAS ----------
E +=H1 ("Ventas (Punto de venta)",14 )
E .append (P ("<i>Menú: Ventas &gt; Ventas (POS). Vendedor y administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Pantalla de venta directa por mostrador. Esta dividida en dos: a la izquierda la búsqueda de productos, a la derecha el carrito y los totales. Debajo, el historial de ventas."))

E .append (P ("14.1  Registrar una venta","h2"))
E .append (OL ([
"El cursor arranca en el <b>buscador</b>: elegir los criterios y escribir el código o la descripción del repuesto.",
"Hacer clic en el producto para <b>agregarlo al carrito</b>. Si se vuelve a hacer clic en el mismo producto, suma una unidad más en lugar de duplicar la línea.",
"En el carrito, ajustar <b>cantidad</b>, <b>precio</b> y <b>descuento</b> de cada línea. Con precios por mayor cargados, el precio se ajusta solo al alcanzar la cantidad de la escala.",
"<b>Cliente (opcional):</b> buscarlo por código/NIT o nombre. Si no se elige ninguno, la venta queda como <i>Consumidor final</i>.",
"Revisar el recuadro de totales: subtotal, descuento, impuesto y total.",
"Presionar <b>Confirmar venta</b>.",
]))
E .append (P ("Al confirmar, el sistema registra la venta con su número (VEN-0001), <b>descuenta el stock</b> de la sucursal del usuario consumiendo los lotes más antiguos, deja los movimientos en el Kardex, abre el <b>comprobante en PDF</b> en una pestaña nueva y limpia el carrito para la próxima venta."))
E +=NOTA ("Si el navegador tiene bloqueador de ventanas emergentes, puede impedir que se abra el comprobante. La venta igualmente queda registrada: el PDF se recupera desde el historial, con el icono de descarga. Conviene permitir las ventanas emergentes del sistema en las computadoras de mostrador.","Ventanas emergentes")

E .append (P ("14.2  Historial de ventas","h2"))
E .append (P ("Debajo del punto de venta se lista cada venta con su número, fecha y hora, cliente, total y <b>origen</b>: la etiqueta <i>POS</i> indica venta directa por mostrador y <i>Proforma</i> indica que nació de una cotización convertida. El selector permite filtrar por cliente y el icono de descarga vuelve a abrir el comprobante."))
E .append (PageBreak ())

# ---------- 15. REPORTES ----------
E +=H1 ("Reportes",15 )
E .append (P ("<i>Menú: Administración &gt; Reportes. Solo administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Cuatro reportes en una sola pantalla. Arriba se elige el reporte con los botones; debajo están los filtros, las tarjetas de resumen, el gráfico (cuando corresponde) y la tabla de detalle."))
E .append (TABLA (
["Reporte","Filtros","Qué entrega"],
[["Ventas por período","Desde / Hasta y agrupación por <b>Día</b>, <b>Semana</b> o <b>Mes</b>",
"Cantidad de ventas y total por período, con gráfico. Resumen: número de ventas, total facturado y ticket promedio."],
["Proformas","Desde / Hasta",
"Listado de proformas con número, fecha, cliente, estado y total. Resumen: emitidas, convertidas, vigentes y vencidas."],
["Productos más vendidos","Desde / Hasta",
"Ranking por unidades vendidas, con el total vendido de cada producto y gráfico de los ocho primeros."],
["Estado de inventario","Sin filtro de fechas (foto del momento)",
"Agrupado por línea/marca: cantidad de productos, unidades, productos bajo mínimo y <b>valorización</b> en Bs. Resumen: valorización total, unidades y productos bajo mínimo."]],
[34 *mm ,44 *mm ,90 *mm ],negrita_col0 =True ))
E .append (P ("15.1  Exportar","h2"))
E .append (P ("Cada reporte tiene los botones <b>Exportar PDF</b> (documento con membrete, listo para imprimir o enviar) y <b>Exportar Excel</b> (planilla con las mismas columnas del reporte en pantalla, para seguir trabajando los datos). Ambos respetan los filtros aplicados en ese momento."))
E +=NOTA ("Por defecto el rango va del primer día del mes en curso a hoy. En una base de pruebas recien cargada, un reporte vacio no es un error: significa que no hubo movimientos en ese rango. Ampliar las fechas antes de reportar una falla.","Al probar")
E .append (PageBreak ())

# ---------- 16. SUCURSALES ----------
E +=H1 ("Sucursales",16 )
E .append (P ("<i>Menú: Administración &gt; Sucursales. Solo administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))
E .append (P ("Define los almacenes o locales de JISSACRUZ. Cada sucursal tiene su propio stock, y cada usuario opera sobre la sucursal que tenga asignada."))
E .append (TABLA (
["Campo","Detalle"],
[["Código","Identificador corto (por ejemplo 1, 2). Es el que aparece en las insignias de stock (<b>1: 18</b>) y en los traspasos."],
["Nombre","Nombre de la sucursal (por ejemplo Casa Matriz). Se muestra en la barra superior y en los PDF."],
["Dirección","Domicilio de la sucursal."],
["Teléfono","Contacto de la sucursal."]],
[28 *mm ,140 *mm ],negrita_col0 =True ))
E .append (P ("Al eliminar una sucursal, esta deja de aparecer en las listas, pero <b>no se altera el stock ni el historial ya registrado</b>. Antes de eliminarla conviene reasignar a los usuarios que la tengan asignada."))
E .append (PageBreak ())

# ---------- 17. CONFIGURACION ----------
E +=H1 ("Configuración",17 )
E .append (P ("<i>Menú: Administración &gt; Configuración. Solo administrador.</i>","nota"))
E .append (Spacer (1 ,3 *mm ))

E .append (P ("17.1  Datos de la empresa","h2"))
E .append (P ("Nombre, NIT, dirección y teléfono de JISSACRUZ. <b>Estos datos son los que se imprimen en el encabezado de todos los PDF</b> (proformas, comprobantes de venta, Kardex y reportes), por lo que conviene revisarlos antes de emitir documentos reales."))
E .append (P ("En el mismo bloque se define el <b>stock mínimo por defecto</b>, que es el valor que se propone para los productos nuevos."))

E .append (P ("17.2  Usuarios","h2"))
E .append (P ("La tabla lista todos los usuarios con su nombre, rol, sucursal, estado y fecha de alta."))
E .append (P ("Crear un usuario","h3"))
E .append (OL ([
"Presionar <b>Nuevo usuario</b>.",
"Cargar <b>nombre completo</b>, <b>correo</b> y una <b>contraseña</b> inicial.",
"Elegir el <b>rol</b> (Vendedor o Administrador) y la <b>sucursal</b> a la que pertenece.",
"Presionar <b>Crear usuario</b>. La cuenta queda activa de inmediato.",
]))
E +=NOTA ("La contraseña inicial se muestra una sola vez, al escribirla: hay que anotarla y comunicarsela al usuario, que después podrá cambiarla. El sistema no la vuelve a mostrar.","Contraseña inicial")
E .append (P ("Cambiar la sucursal o dar de baja","h3"))
E .append (UL ([
"La <b>sucursal</b> se cambia con el selector de la propia fila, sin abrir ninguna ventana.",
"El botón <b>Desactivar</b> bloquea el acceso del usuario sin borrar su historial; <b>Activar</b> lo restablece. Un administrador no puede desactivar su propia cuenta, para no quedar sin acceso al sistema.",
]))
E .append (PageBreak ())

# ---------- 18. PLAN DE PRUEBAS ----------
E +=H1 ("Plan de pruebas de funcionamiento",18 )
E .append (P ("Este capítulo es el guion de la UAT. Recorre el sistema de punta a punta en el mismo orden en que se encadenan los datos, de modo que cada prueba deja preparado el terreno para la siguiente. Se recomienda ejecutarlo completo, marcando cada caso como <b>OK</b> o <b>FALLA</b>, y anotando lo observado cuando el resultado no coincida con lo esperado."))

E .append (P ("18.1  Antes de empezar","h2"))
E .append (UL ([
"Tener creados <b>dos usuarios</b>: uno administrador y uno vendedor, cada uno con su sucursal asignada.",
"Tener creadas <b>al menos dos sucursales</b> (por ejemplo Casa Matriz y Sucursal 2), necesarias para probar traspasos.",
"Trabajar con productos de prueba identificables (por ejemplo con el prefijo TEST-) para no ensuciar el catálogo real.",
"Tener a mano dos navegadores o una ventana de incógnito, para usar el administrador y el vendedor en paralelo.",
]))
E +=NOTA ("Las pruebas de este capítulo <b>modifican datos reales</b> (stock, documentos numerados). Ejecutarlas en el ambiente de pruebas o asumiendo que los movimientos generados quedarán en el historial. Los números de documento consumidos no se reutilizan.","Advertencia")

E .append (P ("18.2  Guion de pruebas","h2"))

casos =[
("A1","Ingreso válido","Ingresar con el usuario administrador.","Entra al Dashboard. Arriba a la derecha figuran el nombre y la sucursal."),
("A2","Ingreso inválido","Ingresar con una contraseña incorrecta.","Aviso rojo de credenciales inválidas. No entra al sistema."),
("A3","Menú por rol","Cerrar sesión e ingresar como vendedor.","No aparecen Dashboard, Proveedores, Compras, Reportes, Sucursales ni Configuración."),
("A4","Cierre de sesión","Usar Cerrar sesión desde el menú de la cuenta.","Vuelve a la pantalla de ingreso; el botón Atrás del navegador no devuelve al sistema."),
("B1","Alta de producto","Como administrador, crear un producto con código, descripción, línea, precio y stock mínimo.","Aviso de producto creado; aparece en la lista con Sin stock (0)."),
("B2","Códigos equivalentes","Editar el producto y agregar dos códigos equivalentes.","Se guardan y se ven al reabrir la ficha."),
("B3","Vehículos compatibles","Agregar marca, modelo y años.","Se guardan y se ven al reabrir la ficha."),
("B4","Precios por mayor","Agregar una escala desde 20 unidades con precio menor al base.","Se guarda. Cargar dos escalas con la misma cantidad debe ser rechazado."),
("B5","Búsqueda por código","Marcar solo Código y escribir parte del código.","El producto aparece en la lista mientras se escribe."),
("B6","Búsqueda por equivalente","Marcar solo Equivalente y buscar uno de los códigos de B2.","Devuelve el producto, aunque ese número no sea su código propio."),
("B7","Búsqueda por fragmentos","Escribir dos palabras parciales separadas por espacio (por ejemplo piston comp).","Devuelve los productos que contienen ambos fragmentos."),
("B8","Producto en modo lectura","Abrir la ficha del producto como vendedor.","Se ve la información pero no hay botón Guardar ni opción de eliminar."),
("C1","Alta de proveedor","Crear un proveedor con nombre y NIT.","Aparece en la lista y en el selector de órdenes de compra."),
("C2","Orden de compra","Crear una orden con el producto de B1: cantidad 10, costo 50.","Orden creada en estado pendiente. <b>El stock sigue en 0.</b>"),
("C3","Recepción","Abrir el detalle de la orden y presionar Recibir mercadería, y confirmar.","La orden pasa a recibida y el stock del producto sube a 10 en la sucursal del usuario."),
("C4","Kardex de la entrada","Abrir el Kardex del producto.","Un movimiento Entrada por compra, cantidad 10, costo 50, saldo 10."),
("C5","Filtro por proveedor","Filtrar la lista de compras por el proveedor de C1.","Solo se ven sus órdenes."),
("D1","Ajuste de salida","Ajustar el producto con salida de 2 unidades y motivo Rotura.","Stock 8. En el Kardex figura Ajuste de salida con el motivo."),
("D2","Motivo obligatorio","Intentar guardar un ajuste sin motivo.","El sistema no permite guardar y marca el campo."),
("D3","Semáforo","Poner el stock mínimo del producto en 10 y volver a Inventario.","El producto se muestra en amarillo como Stock bajo."),
("D4","Exportación del Kardex","Exportar el Kardex a PDF y a Excel.","El PDF abre con el membrete de la empresa; el Excel se descarga con las mismas columnas."),
("E1","Alta de cliente","Crear un cliente con nombre, CI/NIT, complemento, teléfono y dirección.","Aparece en la lista y es ubicable por NIT."),
("E2","Búsqueda de cliente","Buscarlo por teléfono y por NIT.","Aparece en ambos casos."),
("F1","Emitir proforma","Como vendedor, crear una proforma para el cliente de E1 con 2 unidades del producto, 10% de descuento de línea.","Se crea con número PRO-XXXX y el total refleja el descuento."),
("F2","Precio por mayor","En una proforma nueva, poner cantidad 20 del producto con escala.","El precio unitario baja solo al precio de la escala vigente."),
("F3","PDF de proforma","Descargar el PDF de la proforma.","Muestra empresa, logo, sucursal, vendedor, número, datos del cliente, glosa, detalle, TOTAL IMPORTE, importe en letras, validez y tiempo de entrega."),
("F4","Stock sin cambios","Revisar el stock del producto después de emitir la proforma.","<b>El stock no cambió:</b> la proforma no mueve inventario."),
("F5","Filtros de proformas","Filtrar por cliente, por estado y por rango de fechas.","La lista se acota correctamente en cada caso."),
("F6","Conversión a venta","Convertir la proforma a venta y confirmar.","Se crea la venta, la proforma queda Convertida y el stock baja según las unidades."),
("F7","Doble conversión","Intentar convertir la misma proforma otra vez.","El icono ya no está disponible para esa proforma."),
("G1","Venta por POS","Buscar un producto, hacer clic dos veces sobre él, elegir cliente y confirmar.","El carrito muestra cantidad 2 en una sola línea; la venta se registra con número VEN-XXXX."),
("G2","Comprobante","Revisar la pestaña que se abre al confirmar.","Se ve el comprobante en PDF con el detalle y el total en letras."),
("G3","Descuento global","Registrar una venta con descuento global de 10% e impuesto 13%.","El recuadro de totales calcula: subtotal, descuento, impuesto sobre el neto y total."),
("G4","Venta sin cliente","Registrar una venta sin elegir cliente.","Se registra y en el historial figura como Consumidor final."),
("G5","Stock insuficiente","Intentar vender más unidades de las que hay en la sucursal.","El sistema rechaza la venta con un aviso; el stock no cambia."),
("G6","Historial y origen","Revisar el historial de ventas.","Las ventas del POS figuran como POS y la de F6 como Proforma."),
("H1","Crear traspaso","Crear un pedido de la sucursal con stock hacia la otra, con 3 unidades.","Pedido TRA-XXXX en estado PENDIENTE. El stock todavía no cambia."),
("H2","Despachar","Presionar Despachar.","El pedido pasa a ENVIADO y el stock del <b>origen</b> baja 3 unidades."),
("H3","En tránsito","Revisar el stock por sucursal.","Las 3 unidades salieron del origen y todavía no figuran en el destino."),
("H4","Recibir","Presionar Recibir.","El pedido pasa a RECIBIDO y el stock del <b>destino</b> sube 3 unidades. El total general vuelve al valor previo al despacho."),
("H5","Kardex del traspaso","Abrir el Kardex del producto.","Figuran la salida y la entrada del traspaso, con saldos coherentes."),
("H6","Cancelación","Crear otro pedido y cancelarlo estando PENDIENTE.","Pasa a CANCELADO sin haber afectado el stock."),
("I1","Reporte de ventas","Abrir Reportes, elegir Ventas por período con rango que incluya hoy.","Aparecen las ventas de las pruebas; el total coincide con la suma de los comprobantes."),
("I2","Agrupación","Cambiar la agrupación a Semana y a Mes.","La tabla y el gráfico se reagrupan sin cambiar el total."),
("I3","Reporte de proformas","Elegir Proformas con el mismo rango.","El resumen muestra emitidas, convertidas, vigentes y vencidas de forma consistente con lo probado."),
("I4","Más vendidos","Elegir Productos más vendidos.","El producto de prueba encabeza el ranking con las unidades vendidas."),
("I5","Inventario valorizado","Elegir Estado de inventario.","El producto aparece bajo su línea/marca con su valorización."),
("I6","Exportaciones","Exportar a PDF y Excel cada reporte.","Ambos archivos se generan con los datos filtrados en pantalla."),
("J1","Datos de empresa","Cambiar el teléfono de la empresa en Configuración y volver a generar un PDF.","El PDF muestra el teléfono nuevo."),
("J2","Alta de usuario","Crear un usuario vendedor con sucursal.","Puede ingresar con las credenciales indicadas."),
("J3","Desactivación","Desactivar ese usuario e intentar ingresar con el.","No puede operar: el sistema lo devuelve a la pantalla de ingreso."),
("J4","Autoprotección","Intentar desactivar la propia cuenta de administrador.","El botón está deshabilitado con la explicación correspondiente."),
("J5","Cambio de sucursal","Cambiar la sucursal de un vendedor desde la tabla.","Al ingresar, el vendedor ve la sucursal nueva en la barra superior y opera sobre ese stock."),
]

filas_casos =[[c [0 ],f"<b>{c [1 ]}</b>",c [2 ],c [3 ],""]for c in casos ]
E .append (TABLA (["N.","Caso","Qué hacer","Resultado esperado","OK / Falla"],
filas_casos ,[10 *mm ,26 *mm ,55 *mm ,62 *mm ,15 *mm ]))

E .append (Spacer (1 ,5 *mm ))
E .append (P ("18.3  Cómo reportar un hallazgo","h2"))
E .append (P ("Para que una falla se pueda corregir rápido, conviene reportarla con estos datos:"))
E .append (UL ([
"<b>Número del caso</b> del guion (por ejemplo G5) o la pantalla exacta donde ocurrió.",
"<b>Usuario y rol</b> con el que se estaba trabajando, y la sucursal asignada.",
"<b>Qué se hizo</b>, paso a paso, y <b>qué se esperaba</b> que pasara.",
"<b>Qué pasó realmente</b>, con el texto exacto del mensaje de error si lo hubo.",
"<b>Captura de pantalla</b> y, si aplica, el número del documento involucrado (PRO, VEN o TRA).",
]))
E .append (PageBreak ())

# ---------- 19. ERRORES ----------
E +=H1 ("Mensajes y errores frecuentes",19 )
E .append (TABLA (
["Situación","Por qué ocurre","Qué hacer"],
[["<i>Credenciales inválidas</i> al ingresar","Correo o contraseña incorrectos, o cuenta desactivada.","Verificar los datos; si persiste, pedir al administrador que revise el estado de la cuenta en Configuración."],
["El sistema devuelve a la pantalla de ingreso solo","La cuenta fue desactivada o la sesión expiró.","Volver a ingresar; si sigue, consultar al administrador."],
["No aparece una opción del menú","El rol no tiene permiso sobre ese módulo.","Es el comportamiento esperado. Si el usuario necesita ese acceso, el administrador debe cambiarle el rol."],
["<i>Stock insuficiente</i> al vender o despachar","No hay unidades suficientes <b>en la sucursal del usuario</b>.","Revisar el stock por sucursal. Si hay en otra sucursal, hacer primero un traspaso."],
["<i>Ese producto ya está en la orden/proforma</i>","El producto ya fue agregado al documento.","Modificar la cantidad de la línea existente en lugar de agregarlo de nuevo."],
["No se puede eliminar un cliente","El cliente ya tiene proformas o ventas.","Es intencional: se preserva la trazabilidad. Editar sus datos en lugar de eliminarlo."],
["No se abre el PDF del comprobante","El navegador bloqueó la ventana emergente.","Permitir ventanas emergentes para el sitio. La venta ya quedó registrada: descargar el PDF desde el historial."],
["El reporte sale vacio","No hubo movimientos en el rango de fechas elegido.","Ampliar el rango. Recordar que por defecto arranca el primer día del mes en curso."],
["El stock no coincide con lo esperado","Hubo movimientos no considerados (ventas, ajustes, traspasos).","Abrir el Kardex del producto y seguir la columna Saldo: allí está el origen exacto de la diferencia."],
["Una proforma figura como <i>vencida</i>","Paso su plazo de validez.","Es automático. Emitir una proforma nueva si el cliente sigue interesado."],
["La página tarda al abrirse la primera vez","En modo desarrollo, cada pantalla se compila la primera vez que se abre.","No ocurre en producción. Volver a entrar a la misma pantalla es inmediato."]],
[40 *mm ,58 *mm ,70 *mm ],negrita_col0 =True ))
E .append (PageBreak ())

# ---------- 20. ANEXO ----------
E +=H1 ("Anexo técnico",20 )
E .append (P ("Este capítulo está dirigido al responsable técnico, no al usuario final. Resume lo necesario para dejar el sistema operativo antes de las pruebas."))

E .append (P ("20.1  Entorno","h2"))
E .append (TABLA (
["Componente","Detalle"],
[["Aplicación","Next.js 14 (React 18, TypeScript). Se ejecuta con <b>npm run dev</b> en desarrollo y <b>npm run build</b> + <b>npm run start</b> en producción."],
["Base de datos","PostgreSQL gestionado en Supabase, con seguridad a nivel de fila (RLS) activa en todas las tablas."],
["Autenticación","Supabase Auth. No hay registro público: las cuentas se crean desde Configuración."],
["Variables de entorno","URL y claves de Supabase, incluida la clave de servicio necesaria para el alta de usuarios (ver .env.local.example)."],
["Navegadores","Chrome, Edge o Firefox actualizados."]],
[34 *mm ,134 *mm ],negrita_col0 =True ))
E +=NOTA ("No usar <i>next dev --turbo</i> en este proyecto: con la versión de Next.js utilizada rompe la compilación. Ejecutar siempre <b>npm run dev</b>.","Nota de operación")

E .append (P ("20.2  Scripts de base de datos","h2"))
E .append (P ("Los scripts viven en la carpeta <b>supabase/</b> y se ejecutan pegandolos en el editor SQL de Supabase (no hay migraciones automáticas)."))
E .append (UL ([
"<b>Instalación nueva:</b> ejecutar <b>00_setup_completo.sql</b> y luego, en orden, los scripts 12, 13, 14, 16 y 20, que aún no están incorporados a ese paquete.",
"<b>Base existente:</b> ejecutar únicamente los scripts nuevos que falten, en orden numérico. Nunca volver a correr el 00.",
"<b>Verificación:</b> 06 y 08 son pruebas end-to-end con reversión intencional; requieren haber creado antes un usuario de prueba administrador y uno vendedor.",
"El script 07 es un parche histórico y no se aplica en instalaciones nuevas.",
]))
E .append (P ("Scripts que habilitan funciones descritas en este manual: <b>11</b> datos de factura del cliente, <b>12-14</b> sucursales y stock por sucursal, <b>15</b> búsqueda por fragmentos, <b>16</b> sucursal en los documentos, <b>17</b> tiempo de entrega en la proforma, <b>18</b> precios por mayor, <b>19</b> pedidos de traspaso y <b>20</b> corrección del cálculo de stock en la recepción de traspasos."))
E +=NOTA ("El script <b>20</b> es obligatorio si se van a usar traspasos: corrige un error por el cual recibir un traspaso restaba stock en el destino, y recalcula el stock a partir del Kardex.","Imprescindible")

E .append (P ("20.3  Lista de verificación previa a la UAT","h2"))
E .append (UL ([
"Todos los scripts SQL aplicados, incluido el 20.",
"Datos de la empresa cargados en Configuración (se imprimen en todos los PDF).",
"Al menos dos sucursales creadas.",
"Un usuario administrador y un usuario vendedor, cada uno con sucursal asignada.",
"Al menos un proveedor y algunos productos con precio distinto de cero.",
"Ventanas emergentes permitidas en las computadoras de mostrador, para los comprobantes en PDF.",
]))
E .append (Spacer (1 ,8 *mm ))
linea =Table ([[""]],colWidths =[168 *mm ],rowHeights =[1 ])
linea .setStyle (TableStyle ([("BACKGROUND",(0 ,0 ),(-1 ,-1 ),AZUL )]))
E .append (linea )
E .append (Spacer (1 ,4 *mm ))
E .append (P ("Manual de Usuario v1.0 - JISSACRUZ / Dynamic Coding","pie_portada"))

Manual (SALIDA ).build (E )
print ("PDF generado:",SALIDA ,os .path .getsize (SALIDA ),"bytes")
