import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }
  create(createOrderDto: CreateOrderDto) {
    const newOrder = this.order.create({
      data: createOrderDto,
    });
    return newOrder;
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
    });

    if (!order)
      throw new RpcException({
        message: `Order with id ${id} not found`,
        status: HttpStatus.BAD_REQUEST,
      });

    return order;
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;
    const order = await this.order.findUnique({
      where: { id },
    });

    if(order.status === status) {
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
}
