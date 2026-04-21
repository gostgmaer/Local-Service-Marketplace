import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { CategoryService } from "../services/category.service";
import { CategoryQueryDto } from "../dto/category-query.dto";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import {
  PermissionsGuard as RolesGuard,
  Roles,
  RequirePermissions,
} from "@/common/rbac";
import { UpdateCategoryDto } from "../dto/update-category.dto";

@Controller("categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllCategories(@Query() queryDto: CategoryQueryDto): Promise<any> {
    const limit = queryDto.limit ?? 20;
    const page = queryDto.page ?? 1;

    if (queryDto.search) {
      const result = await this.categoryService.searchCategories(
        queryDto.search,
        limit,
      );
      return { ...result, page: 1, limit };
    }
    const result = await this.categoryService.getAllCategories();
    const offset = (page - 1) * limit;
    const paged = (result.data ?? []).slice(offset, offset + limit);
    return { data: paged, total: result.total ?? result.data?.length ?? 0, page, limit };
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async getCategoryById(@Param("id", ParseUUIDPipe) id: string): Promise<any> {
    return this.categoryService.getCategoryById(id);
  }

  @RequirePermissions("categories.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body("name") name: string): Promise<any> {
    return this.categoryService.createCategory(name);
  }

  @RequirePermissions("categories.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async updateCategory(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<any> {
    const updated = await this.categoryService.updateCategory(
      id,
      updateCategoryDto,
    );
    return {
      success: true,
      message: "Category updated successfully",
      data: updated,
    };
  }

  @RequirePermissions("categories.manage")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async deleteCategory(@Param("id", ParseUUIDPipe) id: string): Promise<any> {
    await this.categoryService.deleteCategory(id);
    return {
      success: true,
      message: "Category deactivated successfully",
    };
  }
}
