import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto, PaidOrderDto } from './dto';
import { firstValueFrom } from 'rxjs';
import { NATS_SERVICE } from 'src/config/services';
import { OrderWithProducts } from './interfaces/order-with-product.interface';
import { x } from 'joi';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  constructor(
    @Inject(NATS_SERVICE) private readonly client: ClientProxy,
  ) {
    super();
  }
  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }
  async create(createOrderDto: CreateOrderDto) {
    // console.log(products)

    try {
      const itemsId = createOrderDto.items.map((item) => item.productId);
      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_product' }, itemsId),
      );

      // const totalAmount = product.reduce((acc, item) => {
      //   const orderItem = createOrderDto.items.find(
      //     (orderItem) => orderItem.productId === item.id,
      //   );
      //   return acc + orderItem.quantity * item.price;
      // }, 0);
      // const totalItems = createOrderDto.items.reduce(
      //   (acc, item) => acc + item.quantity,
      //   0,
      // );

      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        // const product = products.find((p) => p.id === orderItem.productId);
        const price = products.find(
          (prod) => prod.id === orderItem.productId,
        ).price;
        return acc + orderItem.quantity * price;
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0);

      const newOrder = await this.order.create({
        data: {
          totalAmount: totalAmount,
          totalItems: totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                quantity: orderItem.quantity,
                productId: orderItem.productId,
                price: products.find((prod) => prod.id === orderItem.productId).price,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            }
          },
        }
      });

      return {
        ...newOrder,
        OrderItem: newOrder.OrderItem.map((item) => ({
          ...item,
          name: products.find((prod) => prod.id === item.productId).name,
        })),
      };

      // return product;
    } catch (error) {
      throw new RpcException(error);
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    // console.log(orderPaginationDto);
    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;
    const status = orderPaginationDto.status;

    const totalPage = await this.order.count({
      where: {
        status: status,
      },
    });

    const orders = await this.order.findMany({
      where: {
        status: status,
      },
      skip: (currentPage - 1) * perPage,
      take: perPage,
    });
    // const orders = await this.order.findMany();
    return {
      data: orders,
      meta: {
        total: totalPage,
        page: currentPage,
        lastPage: Math.ceil(totalPage / perPage),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          }
        },
      }
    });

    if (!order)
      throw new RpcException({
        message: `Order with id ${id} not found`,
        status: HttpStatus.BAD_REQUEST,
      });

    const productsIds = order.OrderItem.map((item) => item.productId);

    const products = await firstValueFrom(
      this.client.send({ cmd: 'validate_product' }, productsIds),
    );

    return {
      ...order,
      OrderItem: order.OrderItem.map((item) => ({
        ...item,
        name: products.find((prod) => prod.id === item.productId).name,
      })),
    };
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;
    const order = await this.order.findUnique({
      where: { id },
    });

    if (order.status === status) {
      return order;
    }

    if (!order)
      throw new RpcException({
        message: `Order with id ${id} not found`,
        status: HttpStatus.BAD_REQUEST,
      });

    const updatedOrder = await this.order.update({
      where: { id },
      data: {
        status,
      },
    });

    return updatedOrder;
  }

  async createPaymentSession(order: OrderWithProducts) {
    // return 123;
    try {
      const paymentSession = await firstValueFrom(
        this.client.send('create.payment.session', {
          orderId: order.id,
          currency: 'usd',
          items: order.OrderItem.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      );
      return paymentSession;
    } catch (error) {
      console.log(error)
      throw new RpcException(error);
    }

  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    const { orderId, receiptUrl, stripePaymentId} = paidOrderDto;
    const order = await this.order.findUnique({
      where: { id: orderId },
    });

    if (!order)
      throw new RpcException({
        message: `Order with id ${orderId} not found`,
        status: HttpStatus.BAD_REQUEST,
      });

    const updatedOrder = await this.order.update({
      where: { id: orderId },
      data: {
        paid: true,
        status: 'PAID',
        paidAt: new Date(),
        stripeChargeId: stripePaymentId,

        // Relation
        OrderReceipt: {
          create: {
            receiptUrl: receiptUrl,
          },
        },
      },
    });

    return updatedOrder;
  }
}
