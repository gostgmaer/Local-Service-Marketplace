import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { CategoryService } from '../services/category.service';
import { ServiceCategory } from '../entities/service-category.entity';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllCategories(): Promise<ServiceCategory[]> {
    return this.categoryService.getAllCategories();
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getCategoryById(@Param('id') id: string): Promise<ServiceCategory> {
    return this.categoryService.getCategoryById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body('name') name: string): Promise<ServiceCategory> {
    return this.categoryService.createCategory(name);
  }
}
