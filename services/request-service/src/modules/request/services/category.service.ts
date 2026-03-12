import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { CategoryRepository } from '../repositories/category.repository';
import { ServiceCategory } from '../entities/service-category.entity';
import { NotFoundException } from '../../../common/exceptions/http.exceptions';

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  async getAllCategories(): Promise<ServiceCategory[]> {
    this.logger.log('Fetching all categories', CategoryService.name);

    const categories = await this.categoryRepository.getAllCategories();

    return categories;
  }

  async getCategoryById(id: string): Promise<ServiceCategory> {
    this.logger.log(`Fetching category: ${id}`, CategoryService.name);

    const category = await this.categoryRepository.getCategoryById(id);

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async createCategory(name: string): Promise<ServiceCategory> {
    this.logger.log(`Creating category: ${name}`, CategoryService.name);

    const category = await this.categoryRepository.createCategory(name);

    this.logger.log(`Category created: ${category.id}`, CategoryService.name);

    return category;
  }
}
