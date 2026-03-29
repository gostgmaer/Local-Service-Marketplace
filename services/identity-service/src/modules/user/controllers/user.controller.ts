import {
	Controller,
	Get,
	Patch,
	Post,
	Body,
	Param,
	Query,
	ParseUUIDPipe,
	HttpCode,
	HttpStatus,
	Inject,
	UseGuards,
} from "@nestjs/common";
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { UserService } from '../services/user.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { AdminUserListQueryDto } from "../dto/admin-user-list-query.dto";
import { AdminCreateUserDto } from "../dto/admin-create-user.dto";
import { ResetUserPasswordDto, SuspendUserDto } from "../dto/admin-user-actions.dto";

@Controller("users")
export class UserController {
	constructor(
		private readonly userService: UserService,
		@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
	) {}

	/**
	 * Admin: list users
	 * GET /users
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Get()
	@HttpCode(HttpStatus.OK)
	async getUsersForAdmin(@Query() queryDto: AdminUserListQueryDto) {
		this.logger.info("GET /users", { context: "UserController", query: queryDto });

		return this.userService.getUsersForAdmin(queryDto);
	}

	/**
	 * Admin: user stats
	 * GET /users/stats
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Get("stats")
	@HttpCode(HttpStatus.OK)
	async getAdminUserStats() {
		this.logger.info("GET /users/stats", { context: "UserController" });

		return this.userService.getAdminUserStats();
	}

	/**
	 * Admin: create user
	 * POST /users
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Post()
	@HttpCode(HttpStatus.CREATED)
	async createUserByAdmin(@Body() createUserDto: AdminCreateUserDto): Promise<UserResponseDto> {
		this.logger.info("POST /users", {
			context: "UserController",
			email: createUserDto.email,
			role: createUserDto.role,
		});

		return this.userService.createUserByAdmin(createUserDto);
	}

	/**
	 * Admin: get user by ID
	 * GET /users/:id
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Get(":id")
	@HttpCode(HttpStatus.OK)
	async getAdminUser(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponseDto> {
		this.logger.info("GET /users/:id", { context: "UserController", user_id: id });

		return this.userService.getUserById(id);
	}

	/**
	 * Admin: suspend user
	 * PATCH /users/:id/suspend
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Patch(":id/suspend")
	@HttpCode(HttpStatus.OK)
	async suspendUser(@Param("id", ParseUUIDPipe) id: string, @Body() body: SuspendUserDto): Promise<UserResponseDto> {
		this.logger.info("PATCH /users/:id/suspend", { context: "UserController", user_id: id, reason: body.reason });

		return this.userService.suspendUser(id);
	}

	/**
	 * Admin: activate user
	 * PATCH /users/:id/activate
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Patch(":id/activate")
	@HttpCode(HttpStatus.OK)
	async activateUser(@Param("id", ParseUUIDPipe) id: string): Promise<UserResponseDto> {
		this.logger.info("PATCH /users/:id/activate", { context: "UserController", user_id: id });

		return this.userService.activateUser(id);
	}

	/**
	 * Admin: reset user password
	 * PATCH /users/:id/reset-password
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Patch(":id/reset-password")
	@HttpCode(HttpStatus.OK)
	async resetUserPassword(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() dto: ResetUserPasswordDto,
	): Promise<{ success: true }> {
		this.logger.info("PATCH /users/:id/reset-password", { context: "UserController", user_id: id });

		return this.userService.resetUserPassword(id, dto);
	}

	/**
	 * Admin: update user by ID
	 * PATCH /users/:id
	 */
	@Roles("admin")
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Patch(":id")
	@HttpCode(HttpStatus.OK)
	async updateUser(
		@Param("id", ParseUUIDPipe) id: string,
		@Body() updateUserDto: UpdateUserDto,
	): Promise<UserResponseDto> {
		this.logger.info("PATCH /users/:id", { context: "UserController", user_id: id });

		return this.userService.updateUser(id, updateUserDto);
	}
}
